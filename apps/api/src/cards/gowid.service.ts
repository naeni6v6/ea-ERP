import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/** 고위드 GET /v2/expenses 응답의 지출 1건 (필요 필드만) */
interface GowidExpense {
  expenseId: number;
  cardApprovalNumber?: string;
  expenseDate: string; // yyyyMMdd
  expenseTime?: string; // HHmmss
  expenseType?: string; // 카드사 거래상태 (매입/취소)
  krwAmount: number;
  currency?: string;
  approvalStatus?: string;
  cardAlias?: string;
  cardUserName?: string;
  shortCardNumber?: string;
  storeName?: string;
  memo?: string;
}

/**
 * 고위드 Open API 수집 프로바이더.
 * - API Key는 GOWID_API_KEY 환경변수 (없으면 동기화 시도 시 안내 메시지)
 * - 지출은 CardExpense 원본으로 저장 (externalId = gowid expenseId → 중복 수집 방지)
 * - 카드는 끝 4자리로 매칭, 없으면 자동 등록 (소지자는 이름이 유일하게 일치할 때만 자동 매핑)
 * - 용도/승인 워크플로는 ERP 쪽 것을 쓴다 — 수집 건은 항상 '미제출'로 들어온다
 */
@Injectable()
export class GowidService {
  private readonly log = new Logger('Gowid');
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private get base() { return process.env.GOWID_API_BASE ?? 'https://openapi.gowid.com'; }
  private get key() { return process.env.GOWID_API_KEY?.trim(); }

  get configured() { return !!this.key; }

  private async call<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    const res = await fetch(`${this.base}${path}${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: this.key!, Accept: 'application/json' },
    });
    const body: any = await res.json().catch(() => null);
    const code = body?.result?.code;
    if (!res.ok || code !== 20000000) {
      const desc = body?.result?.desc ?? `HTTP ${res.status}`;
      if (res.status === 401) throw new BadRequestException(`고위드 인증 실패: ${desc} — API Key를 확인하세요`);
      throw new ServiceUnavailableException(`고위드 API 오류: ${desc} (code ${code ?? res.status})`);
    }
    return body.data as T;
  }

  /** yyyyMMdd (KST) */
  private ymd(d: Date) { return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, ''); }

  /**
   * 주기 자동 수집 — 1분마다 (요청 1건, 문서상 사용량 제한 없음 → 하루 1,440건 수준으로 미미).
   * 고위드는 웹훅(푸시)을 제공하지 않아 폴링이 유일한 방법이며, 남는 지연은 카드사→고위드 반영 시간뿐이다.
   * 키 미설정이면 조용히 건너뛴다. 최근 3일 윈도우 — externalId 중복방지로 겹쳐도 안전.
   * 과거분 백필은 수동 동기화(from/to 지정)로 처리한다.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cronSync() {
    if (!this.configured) return;
    const company = await this.prisma.company.findFirst();
    if (!company) return;
    try {
      const from = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      const r = await this.sync(company.id, null, { from });
      if (r.created > 0 || r.cardsCreated > 0) this.log.log(`cron: +${r.created}건 수집`);
    } catch (e: any) {
      this.log.warn(`cron sync 실패: ${e?.message ?? e}`);
    }
  }

  /** 수동 동기화 (CEO 버튼/API) */
  syncExpenses(u: AuthUser, q: { from?: string; to?: string }) {
    if (!this.configured) {
      throw new BadRequestException('GOWID_API_KEY가 설정되지 않았습니다. 키를 발급받아 apps/api/.env에 넣고 서버를 재시작하세요.');
    }
    return this.sync(u.companyId, u.id, q);
  }

  /**
   * 지출 동기화 본체. 기본 범위: 최근 31일. from/to는 YYYY-MM-DD.
   */
  private async sync(companyId: string, actorId: string | null, q: { from?: string; to?: string }) {
    const endDate = q.to ? q.to.replace(/-/g, '') : this.ymd(new Date());
    const startDate = q.from ? q.from.replace(/-/g, '') : this.ymd(new Date(Date.now() - 31 * 86400000));

    // 전체 페이지 수집
    const all: GowidExpense[] = [];
    for (let page = 0; page < 100; page++) {
      const data = await this.call<{ content: GowidExpense[]; last: boolean; totalElements: number }>(
        '/v2/expenses',
        { startDate, endDate, page, size: 100, sort: 'expenseDate,desc' },
      );
      all.push(...(data.content ?? []));
      if (data.last !== false) break;
    }

    // 카드 캐시 (끝 4자리 → 카드)
    const cards = await this.prisma.corporateCard.findMany({ where: { companyId } });
    const byLast4 = new Map(cards.filter((c) => c.last4).map((c) => [c.last4!, c]));
    const users = await this.prisma.user.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true } });

    let created = 0, skipped = 0, cardsCreated = 0;
    for (const g of all) {
      // shortCardNumber가 "신한 2597"처럼 카드사명을 포함해 오는 경우가 있어 숫자만 추출
      const last4 = (g.shortCardNumber ?? '').replace(/\D/g, '').slice(-4) || '0000';
      let card = byLast4.get(last4);
      if (!card) {
        // 소지자 이름이 유일하게 일치하면 자동 매핑
        const holders = users.filter((x) => g.cardUserName && x.name === g.cardUserName);
        card = await this.prisma.corporateCard.create({
          data: {
            companyId,
            name: g.cardAlias?.trim() || `신한 ${last4}`,
            issuer: '신한카드',
            cardType: 'CREDIT',
            last4,
            source: 'GOWID',
            holderUserId: holders.length === 1 ? holders[0].id : null,
          },
        });
        byLast4.set(last4, card);
        cardsCreated++;
        await this.audit.log({ companyId, actorId, entity: 'CorporateCard', entityId: card.id, action: 'CREATE', after: { auto: 'gowid-sync', name: card.name, last4 } });
      }
      const time = (g.expenseTime ?? '120000').padStart(6, '0');
      const usedAt = new Date(
        `${g.expenseDate.slice(0, 4)}-${g.expenseDate.slice(4, 6)}-${g.expenseDate.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}+09:00`,
      );
      try {
        await this.prisma.cardExpense.create({
          data: {
            companyId,
            cardId: card.id,
            usedAt,
            amount: BigInt(Math.abs(Math.trunc(g.krwAmount ?? 0))),
            currency: g.currency ?? 'KRW',
            storeName: g.storeName ?? null,
            approvalNo: g.cardApprovalNumber ?? null,
            isCancelled: (g.expenseType ?? '').includes('취소'),
            memo: g.memo?.trim() || null,
            source: 'GOWID',
            externalId: String(g.expenseId),
          },
        });
        created++;
      } catch (e: any) {
        if (e.code === 'P2002') skipped++; else throw e;
      }
    }

    const summary = { fetched: all.length, created, skipped, cardsCreated, range: { startDate, endDate } };
    // 자동(actorId 없음) 폴링은 변화가 있을 때만 감사로그를 남긴다 — 1분 주기 무변화 기록은 노이즈
    if (actorId || created > 0 || cardsCreated > 0) {
      this.log.log(`gowid sync: ${JSON.stringify(summary)}`);
      await this.audit.log({ companyId, actorId, entity: 'CorporateCard', entityId: 'gowid-sync', action: 'SYNC', after: summary });
    }
    return summary;
  }
}
