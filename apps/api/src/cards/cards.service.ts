import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CardExpenseStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { JournalService } from '../ledger/journal.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { won } from '../common/money';
import { todaySeoul } from '../common/dates';
import { CardDto, CardExpenseCreateDto, DeriveDto, DimsUpdateDto } from './cards.dto';

/**
 * 법인카드 지출.
 * - 수집값(일시/금액/가맹점)은 원본으로 취급해 수정하지 않는다. 명목·상태만 갱신.
 * - 신용카드(고위드 API)·체크카드(결제계좌 출금 파생) 모두 CardExpense 한 테이블로 본다.
 * - EMPLOYEE는 자기 소지 카드의 지출만 보고 명목을 입력한다. 확인(CONFIRM)은 CEO 전용.
 */
@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private journal: JournalService) {}

  private isManager(u: AuthUser) {
    return u.roles.some((r) => r.role === Role.CEO || r.role === Role.ADMIN);
  }

  /** 월 한도 입력 파싱 — undefined=변경 없음, null·빈값=한도 해제 */
  private parseLimit(v: string | null | undefined): bigint | null | undefined {
    if (v === undefined) return undefined;
    if (v === null || String(v).trim() === '') return null;
    const n = won(v);
    if (n < 0n) throw new BadRequestException('한도는 0 이상이어야 합니다');
    return n;
  }

  // ───── 카드 마스터 ─────
  async listCards(u: AuthUser) {
    const cards = await this.prisma.corporateCard.findMany({
      where: { companyId: u.companyId, ...(this.isManager(u) ? {} : { holderUserId: u.id }) },
      include: { holder: { select: { id: true, name: true } }, bankAccount: { select: { id: true, alias: true, bankName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const ids = cards.map((c) => c.id);
    const pending = await this.prisma.cardExpense.groupBy({
      by: ['cardId'], where: { cardId: { in: ids }, status: 'PENDING' }, _count: { _all: true },
    });
    // 이번 달(KST) 이용금액 — 취소·제외 건은 빼고 합산. 잔여한도 = monthlyLimit - monthUsed
    const monthStart = new Date(`${todaySeoul().slice(0, 7)}-01T00:00:00+09:00`);
    const used = await this.prisma.cardExpense.groupBy({
      by: ['cardId'],
      where: { cardId: { in: ids }, usedAt: { gte: monthStart }, isCancelled: false, status: { not: 'EXCLUDED' } },
      _sum: { amount: true },
    });
    return cards.map((c) => ({
      ...c,
      pendingCount: pending.find((p) => p.cardId === c.id)?._count._all ?? 0,
      monthUsed: used.find((x) => x.cardId === c.id)?._sum.amount ?? 0n,
    }));
  }

  async createCard(u: AuthUser, d: CardDto) {
    await this.assertRefs(u, d);
    const c = await this.prisma.corporateCard.create({
      data: {
        companyId: u.companyId, name: d.name, issuer: d.issuer, cardType: d.cardType ?? 'CREDIT', last4: d.last4,
        holderUserId: d.holderUserId ?? null, bankAccountId: d.bankAccountId ?? null,
        source: d.source ?? (d.bankAccountId ? 'BANK' : 'MANUAL'),
        monthlyLimit: this.parseLimit(d.monthlyLimit) ?? null,
      },
    });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'CorporateCard', entityId: c.id, action: 'CREATE', after: c });
    return c;
  }

  async updateCard(u: AuthUser, id: string, d: Partial<CardDto>) {
    const before = await this.prisma.corporateCard.findFirst({ where: { id, companyId: u.companyId } });
    if (!before) throw new NotFoundException('카드 없음');
    await this.assertRefs(u, d);
    const after = await this.prisma.corporateCard.update({
      where: { id },
      data: {
        name: d.name, issuer: d.issuer, cardType: d.cardType, last4: d.last4, holderUserId: d.holderUserId,
        bankAccountId: d.bankAccountId, source: d.source, isActive: d.isActive,
        monthlyLimit: this.parseLimit(d.monthlyLimit),
      },
    });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'CorporateCard', entityId: id, action: 'UPDATE', before, after });
    return after;
  }

  private async assertRefs(u: AuthUser, d: Partial<CardDto>) {
    if (d.bankAccountId) {
      const acc = await this.prisma.bankAccount.findFirst({ where: { id: d.bankAccountId, companyId: u.companyId } });
      if (!acc) throw new BadRequestException('결제계좌가 없습니다');
    }
    if (d.holderUserId) {
      const holder = await this.prisma.user.findFirst({ where: { id: d.holderUserId, companyId: u.companyId } });
      if (!holder) throw new BadRequestException('소지자가 없습니다');
    }
  }

  // ───── 지출 ─────
  /** status는 콤마 목록 허용 (예: "PENDING,REJECTED" = 미제출 탭) */
  async listExpenses(u: AuthUser, q: { cardId?: string; status?: string; from?: string; to?: string; take?: number }) {
    const base: Prisma.CardExpenseWhereInput = {
      companyId: u.companyId,
      cardId: q.cardId || undefined,
      ...(this.isManager(u) ? {} : { card: { holderUserId: u.id } }),
      usedAt: {
        gte: q.from ? new Date(`${q.from}T00:00:00+09:00`) : undefined,
        lt: q.to ? new Date(new Date(`${q.to}T00:00:00+09:00`).getTime() + 86400000) : undefined,
      },
    };
    const statuses = (q.status ?? '').split(',').map((s) => s.trim()).filter(Boolean) as CardExpenseStatus[];
    const rows = await this.prisma.cardExpense.findMany({
      where: { ...base, ...(statuses.length ? { status: { in: statuses } } : {}) },
      include: {
        card: { select: { id: true, name: true, last4: true, cardType: true, holder: { select: { id: true, name: true } } } },
        account: { select: { id: true, code: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, name: true } },
        journalEntry: { select: { id: true, entryNo: true, status: true } },
      },
      orderBy: { usedAt: 'desc' },
      take: q.take ?? 200,
    });
    const byStatus = await this.prisma.cardExpense.groupBy({ by: ['status'], where: base, _count: { _all: true }, _sum: { amount: true } });
    const pick = (...ss: CardExpenseStatus[]) => {
      const gs = byStatus.filter((x) => ss.includes(x.status));
      return { count: gs.reduce((a, g) => a + g._count._all, 0), amount: gs.reduce((a, g) => a + (g._sum.amount ?? 0n), 0n) };
    };
    return {
      summary: {
        all: pick('PENDING', 'REJECTED', 'SUBMITTED', 'CONFIRMED'),
        notSubmitted: pick('PENDING', 'REJECTED'),
        submitted: pick('SUBMITTED'),
        confirmed: pick('CONFIRMED'),
        excluded: pick('EXCLUDED'),
      },
      rows,
    };
  }

  private async expenseWithAccess(u: AuthUser, id: string) {
    const e = await this.prisma.cardExpense.findFirst({ where: { id, companyId: u.companyId }, include: { card: true } });
    if (!e) throw new NotFoundException('지출 내역 없음');
    if (!this.isManager(u) && e.card.holderUserId !== u.id) throw new ForbiddenException('본인 카드 지출만 처리할 수 있습니다');
    return e;
  }

  async createExpense(u: AuthUser, d: CardExpenseCreateDto) {
    const card = await this.prisma.corporateCard.findFirst({ where: { id: d.cardId, companyId: u.companyId } });
    if (!card) throw new NotFoundException('카드 없음');
    if (!this.isManager(u) && card.holderUserId !== u.id) throw new ForbiddenException('본인 카드만 등록할 수 있습니다');
    const amount = won(d.amount);
    if (amount <= 0n) throw new BadRequestException('금액은 양수여야 합니다');
    const usedAt = new Date(d.usedAt.includes('T') ? d.usedAt : `${d.usedAt}T12:00:00+09:00`);
    const e = await this.prisma.cardExpense.create({
      data: {
        companyId: u.companyId, cardId: card.id, usedAt, amount, storeName: d.storeName, approvalNo: d.approvalNo,
        source: 'MANUAL', memo: d.memo?.trim() || null,
        ...(d.purposeText ? { purposeText: d.purposeText, purposeById: u.id, purposeAt: new Date(), status: 'SUBMITTED' as const } : {}),
      },
    });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'CardExpense', entityId: e.id, action: 'CREATE', after: e });
    return e;
  }

  /** 용도(명목) 입력 = 승인요청 제출 — 소지자 또는 CEO/ADMIN. 제출하면 SUBMITTED, 대표 승인은 다시 받아야 한다. */
  async setPurpose(u: AuthUser, id: string, purposeText: string, memo?: string) {
    const before = await this.expenseWithAccess(u, id);
    if (before.status === 'EXCLUDED') throw new BadRequestException('제외된 지출입니다');
    if (!purposeText.trim()) throw new BadRequestException('용도를 입력하세요');
    const after = await this.prisma.cardExpense.update({
      where: { id },
      data: {
        purposeText: purposeText.trim(),
        ...(memo !== undefined ? { memo: memo.trim() || null } : {}),
        purposeById: u.id, purposeAt: new Date(),
        status: 'SUBMITTED', confirmedById: null, confirmedAt: null, rejectReason: null,
      },
    });
    await this.audit.log({
      companyId: u.companyId, actorId: u.id, entity: 'CardExpense', entityId: id, action: 'SUBMIT',
      before: { purposeText: before.purposeText, memo: before.memo, status: before.status },
      after: { purposeText: after.purposeText, memo: after.memo, status: after.status },
    });
    return after;
  }

  /** 관리회계 차원(계정과목·프로젝트 등) 지정 — CEO/ADMIN. 승인 전 지정하면 분개에 그대로 실린다. */
  async setDims(u: AuthUser, id: string, d: DimsUpdateDto) {
    if (!this.isManager(u)) throw new ForbiddenException('분류 지정 권한이 없습니다');
    const before = await this.expenseWithAccess(u, id);
    if (before.status === 'CONFIRMED') throw new BadRequestException('승인 완료 건은 분류를 바꿀 수 없습니다 (분개 취소 후 재승인)');
    const after = await this.prisma.cardExpense.update({
      where: { id },
      data: {
        accountId: d.accountId !== undefined ? d.accountId || null : undefined,
        projectId: d.projectId !== undefined ? d.projectId || null : undefined,
        departmentId: d.departmentId !== undefined ? d.departmentId || null : undefined,
        businessTypeId: d.businessTypeId !== undefined ? d.businessTypeId || null : undefined,
      },
    });
    return after;
  }

  /** 메모만 수정 — 상태 변화 없음 */
  async setMemo(u: AuthUser, id: string, memo: string) {
    const before = await this.expenseWithAccess(u, id);
    const after = await this.prisma.cardExpense.update({ where: { id }, data: { memo: memo.trim() || null } });
    await this.audit.log({
      companyId: u.companyId, actorId: u.id, entity: 'CardExpense', entityId: id, action: 'SET_MEMO',
      before: { memo: before.memo }, after: { memo: after.memo },
    });
    return after;
  }

  /**
   * 대표 승인 → 자동 회계반영.
   * - 체크카드(은행거래 링크, 미분류): CASH_EXPENSE 분개 + 은행거래 분류까지 한 번에
   * - 체크카드(이미 분류됨): 분개 생략 (이중 계상 방지) — 승인 상태만 기록
   * - 신용카드/수동(은행거래 없음): EXPENSE 분개 (비용 / 미지급금) — 카드대금 출금 시 PAYMENT_AP로 상쇄
   */
  async confirm(u: AuthUser, id: string) {
    const before = await this.prisma.cardExpense.findFirst({
      where: { id, companyId: u.companyId },
      include: { card: true, bankTransaction: { include: { classification: true } } },
    });
    if (!before) throw new NotFoundException('지출 내역 없음');
    if (!before.purposeText) throw new BadRequestException('용도가 입력되지 않은 지출입니다');
    if (before.status === 'EXCLUDED') throw new BadRequestException('제외된 지출입니다');
    if (before.status === 'CONFIRMED') throw new BadRequestException('이미 승인된 지출입니다');

    let journalEntryId = before.journalEntryId;
    let journalNote = '분개 생략';
    if (!journalEntryId) {
      // 부서 기본값: 지정값 → (프로젝트 있으면 주관부서 자동) → 카드 소지자의 소속부서
      let departmentId = before.departmentId ?? undefined;
      if (!departmentId && !before.projectId && before.card.holderUserId) {
        const holder = await this.prisma.user.findUnique({ where: { id: before.card.holderUserId } });
        departmentId = holder?.departmentId ?? undefined;
      }
      const entryDate = new Date(before.usedAt.getTime() + 9 * 3600000).toISOString().slice(0, 10); // KST 기준 사용일
      const memo = `[카드] ${before.card.name} ${before.storeName ?? ''} — ${before.purposeText}`.trim();
      const dims = { businessTypeId: before.businessTypeId ?? undefined, departmentId, projectId: before.projectId ?? undefined };

      const alreadyClassified = before.bankTransaction?.classification?.status === 'CLASSIFIED';
      if (before.bankTransactionId && !alreadyClassified) {
        const entry = await this.journal.create(u, {
          type: 'CASH_EXPENSE', entryDate, amount: before.amount.toString(),
          accountId: before.accountId ?? undefined,
          bankAccountId: before.card.bankAccountId ?? before.bankTransaction!.bankAccountId,
          bankTransactionId: before.bankTransactionId, memo, dims,
        } as any);
        journalEntryId = entry.id;
        journalNote = `CASH_EXPENSE #${entry.entryNo} (은행거래 분류 포함)`;
      } else if (!before.bankTransactionId) {
        const entry = await this.journal.create(u, {
          type: 'EXPENSE', entryDate, amount: before.amount.toString(),
          accountId: before.accountId ?? undefined, memo, dims,
        } as any);
        journalEntryId = entry.id;
        journalNote = `EXPENSE #${entry.entryNo} (미지급금 계상)`;
      } else {
        journalNote = '은행거래가 이미 분류되어 분개 생략 (이중 계상 방지)';
      }
    }

    const after = await this.prisma.cardExpense.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedById: u.id, confirmedAt: new Date(), rejectReason: null, journalEntryId },
    });
    await this.audit.log({
      companyId: u.companyId, actorId: u.id, entity: 'CardExpense', entityId: id, action: 'CONFIRM',
      before: { status: before.status }, after: { status: 'CONFIRMED', journal: journalNote },
    });
    return after;
  }

  /** 대표 일괄 승인 — 건별로 승인+분개. 실패한 건은 건너뛰고 사유를 모아 반환 */
  async confirmBulk(u: AuthUser, ids: string[]) {
    if (!ids?.length) throw new BadRequestException('선택된 지출이 없습니다');
    let confirmed = 0;
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await this.confirm(u, id);
        confirmed++;
      } catch (e: any) {
        errors.push(e?.message ?? String(e));
      }
    }
    return { requested: ids.length, confirmed, skipped: ids.length - confirmed, errors: errors.slice(0, 5) };
  }

  /** 대표 반려 — 직원이 용도를 수정해 재제출한다 */
  async reject(u: AuthUser, id: string, reason: string) {
    const before = await this.expenseWithAccess(u, id);
    if (before.status !== 'SUBMITTED') throw new BadRequestException('승인 대기 상태만 반려할 수 있습니다');
    if (!reason?.trim()) throw new BadRequestException('반려 사유를 입력하세요');
    const after = await this.prisma.cardExpense.update({ where: { id }, data: { status: 'REJECTED', rejectReason: reason.trim(), confirmedById: null, confirmedAt: null } });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'CardExpense', entityId: id, action: 'REJECT', before: { status: before.status }, after: { status: 'REJECTED' }, reason });
    return after;
  }

  /** 카드지출 아님(연회비·오인식 등) 처리 */
  async exclude(u: AuthUser, id: string, reason?: string) {
    const before = await this.expenseWithAccess(u, id);
    const after = await this.prisma.cardExpense.update({ where: { id }, data: { status: 'EXCLUDED' } });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'CardExpense', entityId: id, action: 'EXCLUDE', before: { status: before.status }, after: { status: 'EXCLUDED' }, reason });
    return after;
  }

  /** 제외 되돌리기 → 미제출로 복원 */
  async restore(u: AuthUser, id: string) {
    const before = await this.expenseWithAccess(u, id);
    if (before.status !== 'EXCLUDED') throw new BadRequestException('제외된 지출만 복원할 수 있습니다');
    const after = await this.prisma.cardExpense.update({ where: { id }, data: { status: 'PENDING' } });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'CardExpense', entityId: id, action: 'RESTORE', before: { status: 'EXCLUDED' }, after: { status: 'PENDING' } });
    return after;
  }

  /**
   * 체크카드: 결제계좌의 출금 거래를 카드지출로 파생한다.
   * 은행 원본(BankTransaction)은 그대로 두고, 링크된 CardExpense 행을 만든다. 이미 파생된 건은 건너뜀.
   */
  async deriveFromBank(u: AuthUser, cardId: string, d: DeriveDto) {
    const card = await this.prisma.corporateCard.findFirst({ where: { id: cardId, companyId: u.companyId } });
    if (!card) throw new NotFoundException('카드 없음');
    if (!card.bankAccountId) throw new BadRequestException('결제계좌가 연결되지 않은 카드입니다 (체크카드만 가능)');
    const txns = await this.prisma.bankTransaction.findMany({
      where: {
        bankAccountId: card.bankAccountId,
        direction: 'OUT',
        cardExpense: null,
        txnAt: {
          gte: d.from ? new Date(`${d.from}T00:00:00+09:00`) : undefined,
          lt: d.to ? new Date(new Date(`${d.to}T00:00:00+09:00`).getTime() + 86400000) : undefined,
        },
      },
      orderBy: { txnAt: 'asc' },
    });
    let created = 0, skipped = 0;
    for (const t of txns) {
      try {
        await this.prisma.cardExpense.create({
          data: {
            companyId: u.companyId, cardId: card.id, usedAt: t.txnAt, amount: t.amount,
            storeName: t.counterpartyRaw ?? t.descriptionRaw ?? null,
            source: 'BANK', externalId: t.id, bankTransactionId: t.id,
          },
        });
        created++;
      } catch (e: any) {
        if (e.code === 'P2002') skipped++; else throw e;
      }
    }
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'CorporateCard', entityId: cardId, action: 'DERIVE_FROM_BANK', after: { scanned: txns.length, created, skipped } });
    return { scanned: txns.length, created, skipped };
  }
}
