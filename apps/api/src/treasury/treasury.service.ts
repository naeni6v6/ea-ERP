import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { won } from '../common/money';
import { toDateOnly, todaySeoul } from '../common/dates';
import { BankAccountDto, ImportDto, PlannedDto, ReserveDto, ReserveMoveDto } from './treasury.dto';

@Injectable()
export class TreasuryService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ───── 계좌 ─────
  /** 잔액 = 기초잔액 + Σ입금 − Σ출금 (원본 은행거래 기준) */
  async balances(cid: string) {
    const accounts = await this.prisma.bankAccount.findMany({ where: { companyId: cid, isActive: true }, include: { department: { select: { name: true } } }, orderBy: { createdAt: 'asc' } });
    const sums = await this.prisma.bankTransaction.groupBy({ by: ['bankAccountId', 'direction'], where: { bankAccount: { companyId: cid } }, _sum: { amount: true } });
    return accounts.map((a) => {
      const inn = sums.find((s) => s.bankAccountId === a.id && s.direction === 'IN')?._sum.amount ?? 0n;
      const out = sums.find((s) => s.bankAccountId === a.id && s.direction === 'OUT')?._sum.amount ?? 0n;
      return { ...a, balance: a.openingBalance + inn - out };
    });
  }
  createAccount(u: AuthUser, d: BankAccountDto) {
    return this.prisma.bankAccount.create({ data: { companyId: u.companyId, bankName: d.bankName, alias: d.alias, accountNoMasked: d.accountNoMasked, departmentId: d.departmentId ?? null, purpose: d.purpose ?? 'OPERATING', isRestricted: d.isRestricted ?? false, openingBalance: won(d.openingBalance ?? 0), openingDate: toDateOnly(d.openingDate ?? todaySeoul()) } });
  }
  async updateAccount(u: AuthUser, id: string, d: Partial<BankAccountDto>) {
    const before = await this.prisma.bankAccount.findFirst({ where: { id, companyId: u.companyId } });
    if (!before) throw new NotFoundException();
    const data: Prisma.BankAccountUncheckedUpdateInput = { bankName: d.bankName, alias: d.alias, accountNoMasked: d.accountNoMasked, departmentId: d.departmentId, purpose: d.purpose, isRestricted: d.isRestricted, isActive: d.isActive };
    if (d.openingBalance !== undefined) data.openingBalance = won(d.openingBalance);
    if (d.openingDate) data.openingDate = toDateOnly(d.openingDate);
    const after = await this.prisma.bankAccount.update({ where: { id }, data });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'BankAccount', entityId: id, action: 'UPDATE', before, after });
    return after;
  }

  // ───── 은행거래 (원본, INSERT ONLY) ─────
  async importRows(u: AuthUser, d: ImportDto) {
    const acc = await this.prisma.bankAccount.findFirst({ where: { id: d.bankAccountId, companyId: u.companyId } });
    if (!acc) throw new NotFoundException('계좌 없음');
    const batchId = `imp_${Date.now()}`;
    let inserted = 0, skipped = 0;
    for (const r of d.rows) {
      const data = { bankAccountId: acc.id, txnAt: new Date(r.txnAt), direction: r.direction, amount: won(r.amount), counterpartyRaw: r.counterpartyRaw ?? null, descriptionRaw: r.descriptionRaw ?? null, balanceAfter: r.balanceAfter !== undefined ? won(r.balanceAfter) : null, source: 'IMPORT' as const, importBatchId: batchId, externalId: r.externalId ?? null };
      if (data.amount <= 0n) throw new BadRequestException('amount는 양수여야 합니다 (방향은 direction으로)');
      try {
        const bt = await this.prisma.bankTransaction.create({ data });
        await this.prisma.bankTxnClassification.create({ data: { bankTransactionId: bt.id, status: 'UNCLASSIFIED' } });
        inserted++;
      } catch (e: any) { if (e.code === 'P2002') skipped++; else throw e; } // externalId 중복 → 건너뜀
    }
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'BankImport', entityId: batchId, action: 'IMPORT', after: { bankAccountId: acc.id, inserted, skipped } });
    return { batchId, inserted, skipped };
  }
  listTransactions(cid: string, q: { bankAccountId?: string; from?: string; to?: string; status?: string; take?: number }) {
    return this.prisma.bankTransaction.findMany({
      where: { bankAccount: { companyId: cid }, bankAccountId: q.bankAccountId, txnAt: { gte: q.from ? new Date(`${q.from}T00:00:00+09:00`) : undefined, lt: q.to ? new Date(new Date(`${q.to}T00:00:00+09:00`).getTime() + 86400000) : undefined }, ...(q.status ? { classification: { status: q.status as any } } : {}) },
      include: { bankAccount: { select: { alias: true, bankName: true } }, classification: { include: { journalEntry: { select: { id: true, entryNo: true, type: true, memo: true } } } } },
      orderBy: { txnAt: 'desc' }, take: q.take ?? 100,
    });
  }
  async ignoreTransaction(u: AuthUser, id: string, reason?: string) {
    await this.prisma.bankTxnClassification.update({ where: { bankTransactionId: id }, data: { status: 'IGNORED', classifiedById: u.id, classifiedAt: new Date() } });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'BankTransaction', entityId: id, action: 'IGNORE', reason });
    return { ok: true };
  }

  // ───── 경영유보금 (관리지표) ─────
  listReserves(cid: string) { return this.prisma.cashReserve.findMany({ where: { companyId: cid }, include: { movements: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } }); }
  async createReserve(u: AuthUser, d: ReserveDto) {
    const amount = won(d.amount); if (amount <= 0n) throw new BadRequestException('금액은 0보다 커야 합니다');
    const r = await this.prisma.cashReserve.create({ data: { companyId: u.companyId, category: d.category, purpose: d.purpose, amount, memo: d.memo, createdById: u.id, movements: { create: { type: 'SET', amount, reason: d.reason ?? '최초 설정', actorId: u.id } } } });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'CashReserve', entityId: r.id, action: 'RESERVE_SET', after: { category: d.category, purpose: d.purpose, amount }, reason: d.reason });
    return r;
  }
  /** 증액 / 해제 (부분·전체). 해제 흐름: 경영유보금 해제 → 가용현금 증가 → 실제 지급은 별도 거래로 기록 */
  async moveReserve(u: AuthUser, id: string, d: ReserveMoveDto) {
    const r = await this.prisma.cashReserve.findFirst({ where: { id, companyId: u.companyId } });
    if (!r) throw new NotFoundException();
    const amt = won(d.amount); if (amt <= 0n) throw new BadRequestException('금액 오류');
    if (d.type === 'RELEASE' && amt > r.amount) throw new BadRequestException('해제 금액이 유보금 잔액을 초과합니다');
    const newAmount = d.type === 'INCREASE' ? r.amount + amt : r.amount - amt;
    const after = await this.prisma.cashReserve.update({ where: { id }, data: { amount: newAmount, status: newAmount === 0n ? 'RELEASED' : 'ACTIVE', movements: { create: { type: d.type, amount: amt, reason: d.reason, actorId: u.id } } }, include: { movements: true } });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'CashReserve', entityId: id, action: d.type === 'RELEASE' ? 'RESERVE_RELEASE' : 'RESERVE_INCREASE', before: { amount: r.amount }, after: { amount: newAmount }, reason: d.reason });
    return after;
  }

  // ───── 지급예정자금 ─────
  listPlanned(cid: string, q: { status?: string; kind?: string; from?: string; to?: string }) {
    return this.prisma.plannedPayment.findMany({ where: { companyId: cid, status: (q.status as any) ?? 'SCHEDULED', kind: q.kind as any, dueDate: { gte: q.from ? toDateOnly(q.from) : undefined, lte: q.to ? toDateOnly(q.to) : undefined } }, include: { department: { select: { name: true } }, project: { select: { name: true } }, businessType: { select: { name: true } } }, orderBy: { dueDate: 'asc' } });
  }
  async createPlanned(u: AuthUser, d: PlannedDto) {
    const p = await this.prisma.plannedPayment.create({ data: { companyId: u.companyId, kind: d.kind, title: d.title, category: d.category, amount: won(d.amount), dueDate: toDateOnly(d.dueDate), businessTypeId: d.businessTypeId, departmentId: d.departmentId, projectId: d.projectId, memo: d.memo } });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'PlannedPayment', entityId: p.id, action: 'CREATE', after: d });
    return p;
  }
  async updatePlanned(u: AuthUser, id: string, d: Partial<PlannedDto> & { status?: string; linkedEntryId?: string }) {
    const before = await this.prisma.plannedPayment.findFirst({ where: { id, companyId: u.companyId } });
    if (!before) throw new NotFoundException();
    const data: Prisma.PlannedPaymentUncheckedUpdateInput = { kind: d.kind, title: d.title, category: d.category, memo: d.memo, status: d.status as any, businessTypeId: d.businessTypeId, departmentId: d.departmentId, projectId: d.projectId, linkedEntryId: d.linkedEntryId };
    if (d.amount !== undefined) data.amount = won(d.amount);
    if (d.dueDate) data.dueDate = toDateOnly(d.dueDate);
    const after = await this.prisma.plannedPayment.update({ where: { id }, data });
    await this.audit.log({ companyId: u.companyId, actorId: u.id, entity: 'PlannedPayment', entityId: id, action: 'UPDATE', before, after });
    return after;
  }
}
