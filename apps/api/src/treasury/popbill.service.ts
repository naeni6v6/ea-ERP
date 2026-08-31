import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/* eslint-disable @typescript-eslint/no-var-requires */
const popbill = require('popbill');

/** 팝빌 계좌조회(EasyFin) 거래내역 한 건 — 문서의 EasyFinBankSearchDetail */
interface PopbillTxn {
  tid: string; // 팝빌이 부여하는 거래 고유값 → 우리 externalId
  trdate: string; // yyyyMMdd
  trdt: string; // yyyyMMddHHmmss
  trserial: number;
  accIn: string; // 입금액
  accOut: string; // 출금액
  balance: string; // 거래후잔액
  remark1?: string;
  remark2?: string;
  remark3?: string;
  remark4?: string;
  memo?: string;
}

interface JobState {
  jobID: string;
  jobState: number; // 0 접수 / 1 대기 / 2 진행 / 3 완료
  errorCode: number; // 1 성공, 음수 실패
  errorReason?: string;
}

const YMD = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d).replace(/-/g, '');

/** "20260831143012" → Date (KST 기준으로 해석) */
const parseTrdt = (trdt: string, trdate: string): Date => {
  const s = trdt && trdt.length >= 14 ? trdt : `${trdate}000000`;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}+09:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date(`${trdate.slice(0, 4)}-${trdate.slice(4, 6)}-${trdate.slice(6, 8)}T12:00:00+09:00`) : d;
};

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
const clean = (s: string | null | undefined) => (s ?? '').trim();

/**
 * 팝빌 계좌조회 연동.
 * 흐름: requestJob(수집 요청) → getJobState(완료 대기) → search(페이지 순회) → BankTransaction 저장.
 * 팝빌의 tid를 externalId로 그대로 쓰기 때문에 같은 기간을 여러 번 동기화해도 중복이 생기지 않는다.
 */
@Injectable()
export class PopbillService {
  private readonly log = new Logger(PopbillService.name);
  private svc: any = null;

  constructor(private prisma: PrismaService, private audit: AuditService) {
    const LinkID = process.env.POPBILL_LINK_ID;
    const SecretKey = process.env.POPBILL_SECRET_KEY;
    if (LinkID && SecretKey) {
      popbill.config({
        LinkID,
        SecretKey,
        IsTest: process.env.POPBILL_IS_TEST !== 'false',
        IPRestrictOnUse: true,
        UseStaticIP: false,
        UseLocalTimeYN: true,
        defaultErrorHandler: (err: any) => this.log.error(`팝빌 오류 ${err?.code}: ${err?.message}`),
      });
      this.svc = popbill.EasyFinBankService();
    }
  }

  get configured() {
    return !!this.svc && !!process.env.POPBILL_CORP_NUM;
  }
  private get corpNum() {
    return digits(process.env.POPBILL_CORP_NUM);
  }
  private get userId() {
    return clean(process.env.POPBILL_USER_ID);
  }

  status() {
    return {
      configured: this.configured,
      isTest: process.env.POPBILL_IS_TEST !== 'false',
      corpNum: this.corpNum ? `${this.corpNum.slice(0, 3)}****${this.corpNum.slice(-3)}` : null,
    };
  }

  /** 콜백 기반 SDK를 Promise로 감싼다 */
  private call<T>(method: string, args: any[]): Promise<T> {
    if (!this.svc) throw new BadRequestException('팝빌 연동이 설정되지 않았습니다 (.env의 POPBILL_* 확인)');
    return new Promise((resolve, reject) =>
      this.svc[method](
        ...args,
        (res: T) => resolve(res),
        (err: any) => reject(new BadRequestException(`팝빌 오류 ${err?.code ?? ''}: ${err?.message ?? '알 수 없음'}`)),
      ),
    );
  }

  /** 팝빌에 등록된 계좌 목록 — 우리 계좌와 매핑할 때 쓴다 */
  listPopbillAccounts() {
    return this.call<any[]>('listBankAccount', [this.corpNum, this.userId]);
  }

  /** 팝빌 계좌 관리(등록·해지) 팝업 URL — 은행 인증정보는 팝빌 화면에서 직접 입력한다 */
  async manageUrl() {
    const r = await this.call<any>('getBankAccountMgtURL', [this.corpNum, this.userId]);
    return { url: typeof r === 'string' ? r : (r?.url ?? null) };
  }

  /** 수집 완료까지 대기 (팝빌 수집은 비동기 작업) */
  private async waitForJob(jobID: string, timeoutMs = 120_000): Promise<JobState> {
    const started = Date.now();
    for (;;) {
      const st = await this.call<JobState>('getJobState', [this.corpNum, jobID, this.userId]);
      if (st.jobState === 3) {
        if (Number(st.errorCode) !== 1) {
          throw new BadRequestException(`팝빌 수집 실패: ${st.errorReason || st.errorCode}`);
        }
        return st;
      }
      if (Date.now() - started > timeoutMs) throw new BadRequestException('팝빌 수집이 시간 안에 끝나지 않았습니다. 잠시 후 다시 시도하세요.');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  /**
   * 계좌 하나를 기간만큼 동기화한다.
   * from/to 생략 시 마지막 동기화 시각 기준 최근 구간(기본 7일, 최초 1회는 31일)을 가져온다.
   */
  async syncAccount(u: AuthUser, bankAccountId: string, from?: string, to?: string) {
    if (!this.configured) throw new BadRequestException('팝빌 연동이 설정되지 않았습니다 (.env의 POPBILL_* 확인)');

    const acc = await this.prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId: u.companyId } });
    if (!acc) throw new NotFoundException('계좌 없음');
    if (!acc.popbillBankCode || !acc.popbillAccountNumber)
      throw new BadRequestException('이 계좌에 팝빌 기관코드·계좌번호가 설정되어 있지 않습니다.');

    const today = new Date();
    const backDays = acc.popbillSyncedAt ? 7 : 31; // 재동기화는 최근 7일, 최초 연결은 31일
    const defaultFrom = new Date(today.getTime() - backDays * 86400000);
    const SDate = from ? from.replace(/-/g, '') : YMD(defaultFrom);
    const EDate = to ? to.replace(/-/g, '') : YMD(today);

    const jobID = await this.call<string>('requestJob', [
      this.corpNum,
      acc.popbillBankCode,
      digits(acc.popbillAccountNumber),
      SDate,
      EDate,
      this.userId,
    ]);
    await this.waitForJob(jobID);

    let page = 1;
    let inserted = 0;
    let skipped = 0;
    let total = 0;
    for (;;) {
      const res = await this.call<any>('search', [this.corpNum, jobID, '', '', page, 500, 'A', this.userId]);
      total = Number(res?.total ?? 0);
      const list: PopbillTxn[] = res?.list ?? [];
      for (const t of list) {
        const inAmt = BigInt(digits(t.accIn) || '0');
        const outAmt = BigInt(digits(t.accOut) || '0');
        const isIn = inAmt > 0n;
        const amount = isIn ? inAmt : outAmt;
        if (amount <= 0n) continue; // 금액 0인 행은 거래로 보지 않는다
        const desc = [t.remark2, t.remark3, t.remark4, t.memo].map(clean).filter(Boolean).join(' ');
        try {
          const bt = await this.prisma.bankTransaction.create({
            data: {
              bankAccountId: acc.id,
              txnAt: parseTrdt(t.trdt, t.trdate),
              direction: isIn ? 'IN' : 'OUT',
              amount,
              counterpartyRaw: clean(t.remark1) || null,
              descriptionRaw: desc || null,
              balanceAfter: t.balance ? BigInt(digits(t.balance) || '0') : null,
              source: 'BANK',
              externalId: t.tid, // 팝빌 고유값 → 재동기화해도 중복되지 않음
            },
          });
          await this.prisma.bankTxnClassification.create({ data: { bankTransactionId: bt.id, status: 'UNCLASSIFIED' } });
          inserted++;
        } catch (e: any) {
          if (e.code === 'P2002') skipped++;
          else throw e;
        }
      }
      const pageCount = Number(res?.pageCount ?? 1);
      if (!list.length || page >= pageCount) break;
      page++;
    }

    await this.prisma.bankAccount.update({ where: { id: acc.id }, data: { popbillSyncedAt: new Date() } });
    await this.audit.log({
      companyId: u.companyId,
      actorId: u.id,
      entity: 'PopbillSync',
      entityId: acc.id,
      action: 'SYNC',
      after: { bankAccountId: acc.id, SDate, EDate, total, inserted, skipped },
    });
    return { bankAccountId: acc.id, alias: acc.alias, from: SDate, to: EDate, total, inserted, skipped };
  }

  /** 팝빌 정보가 연결된 모든 계좌를 동기화 */
  async syncAll(u: AuthUser, from?: string, to?: string) {
    const accs = await this.prisma.bankAccount.findMany({
      where: { companyId: u.companyId, isActive: true, NOT: [{ popbillBankCode: null }, { popbillAccountNumber: null }] },
    });
    const results: Record<string, unknown>[] = [];
    for (const a of accs) {
      try {
        results.push(await this.syncAccount(u, a.id, from, to));
      } catch (e: any) {
        results.push({ bankAccountId: a.id, alias: a.alias, error: e?.message ?? '동기화 실패' });
      }
    }
    return { accounts: results.length, results };
  }
}
