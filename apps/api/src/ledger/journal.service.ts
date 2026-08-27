import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../common/scope/scope.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { won } from '../common/money';
import { toDateOnly } from '../common/dates';
import { CreateEntryDto, DimsDto, EntryType } from './ledger.dto';

interface LineDraft { systemKey?: string; accountId?: string; debit?: bigint; credit?: bigint; bankAccountId?: string | null; memo?: string; dims?: DimsDto }
/** 현금(예금)이 움직이는 템플릿과 방향 */
const CASH_TEMPLATES: Record<string, 'IN' | 'OUT'> = { CASH_SALES: 'IN', RECEIPT_AR: 'IN', CONTRACT_PREPAY: 'IN', OTHER_INCOME: 'IN', CASH_EXPENSE: 'OUT', PAYMENT_AP: 'OUT', PREPAID: 'OUT' };

/**
 * 경량 복식부기 원장.
 * UI는 템플릿(매출발생/입금/비용/출금…)으로 입력하고, 내부는 항상 균형 잡힌 분개(JournalLine)로 저장한다.
 * 손익 ≠ 현금: 손익은 REVENUE/EXPENSE 라인 집계, 현금은 BankTransaction 집계.
 */
@Injectable()
export class JournalService {
  constructor(private prisma: PrismaService, private scope: ScopeService, private audit: AuditService) {}

  private async accountBySystemKey(cid: string, key: string) {
    const a = await this.prisma.account.findUnique({ where: { companyId_systemKey: { companyId: cid, systemKey: key } } });
    if (!a) throw new BadRequestException(`시스템 계정과목 누락: ${key}. 설정 > 계정과목에서 systemKey를 지정하세요`);
    return a.id;
  }

  /** 템플릿 → 라인 초안 */
  private buildLines(d: CreateEntryDto): LineDraft[] {
    const amt = won(d.amount ?? 0); const vat = won(d.vatAmount ?? 0); const gross = amt + vat;
    if (d.type !== 'MANUAL' && d.type !== 'TRANSFER' && amt <= 0n) throw new BadRequestException('amount(공급가액)는 0보다 커야 합니다');
    const cash = (dir: 'IN' | 'OUT'): LineDraft => {
      if (!d.bankAccountId) throw new BadRequestException(`${d.type} 템플릿은 bankAccountId가 필요합니다`);
      return { systemKey: 'CASH_BANK', bankAccountId: d.bankAccountId, ...(dir === 'IN' ? { debit: gross } : { credit: gross }) };
    };
    const vatOut: LineDraft[] = vat > 0n ? [{ systemKey: 'VAT_OUT', credit: vat }] : [];
    const vatIn: LineDraft[] = vat > 0n ? [{ systemKey: 'VAT_IN', debit: vat }] : [];
    switch (d.type) {
      case 'SALES':            return [{ systemKey: 'AR', debit: gross }, { accountId: d.accountId, systemKey: 'SALES_DEFAULT', credit: amt }, ...vatOut];
      case 'CASH_SALES':       return [cash('IN'), { accountId: d.accountId, systemKey: 'SALES_DEFAULT', credit: amt }, ...vatOut];
      case 'RECEIPT_AR':       return [cash('IN'), { systemKey: 'AR', credit: gross }];
      case 'EXPENSE':          return [{ accountId: d.accountId, systemKey: 'SGA_DEFAULT', debit: amt }, ...vatIn, { systemKey: 'AP', credit: gross }];
      case 'CASH_EXPENSE':     return [{ accountId: d.accountId, systemKey: 'SGA_DEFAULT', debit: amt }, ...vatIn, cash('OUT')];
      case 'PAYMENT_AP':       return [{ systemKey: 'AP', debit: gross }, cash('OUT')];
      case 'PREPAID':          return [{ systemKey: 'PREPAID', debit: amt }, ...vatIn, cash('OUT')];
      case 'PREPAID_AMORTIZE': return [{ accountId: d.accountId, systemKey: 'RENT', debit: amt }, { systemKey: 'PREPAID', credit: amt }];
      case 'CONTRACT_PREPAY':  return [cash('IN'), { systemKey: 'CONTRACT_LIAB', credit: gross }];
      case 'CONTRACT_RECOGNIZE': return [{ systemKey: 'CONTRACT_LIAB', debit: gross }, { accountId: d.accountId, systemKey: 'SALES_DEFAULT', credit: amt }, ...vatOut];
      case 'OTHER_INCOME':     return [cash('IN'), { accountId: d.accountId, systemKey: 'SALES_DEFAULT', credit: gross }];
      case 'TRANSFER': {
        if (!d.bankAccountId || !d.toBankAccountId) throw new BadRequestException('TRANSFER는 bankAccountId(출금)·toBankAccountId(입금)이 필요합니다');
        const a = won(d.amount ?? 0); if (a <= 0n) throw new BadRequestException('amount 필요');
        return [{ systemKey: 'CASH_BANK', bankAccountId: d.toBankAccountId, debit: a }, { systemKey: 'CASH_BANK', bankAccountId: d.bankAccountId, credit: a }];
      }
      case 'MANUAL': {
        if (!d.lines?.length) throw new BadRequestException('MANUAL은 lines가 필요합니다');
        return d.lines.map((l) => ({ accountId: l.accountId, debit: won(l.debit ?? 0), credit: won(l.credit ?? 0), bankAccountId: l.bankAccountId ?? null, memo: l.memo, dims: l.dims }));
      }
    }
  }

  async create(user: AuthUser, d: CreateEntryDto) {
    const s = await this.scope.resolve(user);
    if (!s.isAdmin) throw new ForbiddenException('거래 등록 권한이 없습니다');
    const dims = d.dims ?? {};
    if (dims.projectId && s.projectIds !== 'ALL' && !s.projectIds.includes(dims.projectId)) throw new ForbiddenException('프로젝트 권한 없음');
    if (dims.departmentId && s.departmentIds !== 'ALL' && !s.departmentIds.includes(dims.departmentId)) throw new ForbiddenException('부서 권한 없음');
    // 프로젝트가 지정되면 사업유형/주관부서 기본값 자동 보완
    if (dims.projectId && (!dims.businessTypeId || !dims.departmentId)) {
      const p = await this.prisma.project.findUnique({ where: { id: dims.projectId } });
      if (p) { dims.businessTypeId ??= p.businessTypeId; dims.departmentId ??= p.leadDepartmentId; }
    }

    const drafts = this.buildLines(d);
    const lines: Prisma.JournalLineUncheckedCreateWithoutEntryInput[] = [];
    for (const l of drafts) {
      const accountId = l.accountId ?? (l.systemKey ? await this.accountBySystemKey(user.companyId, l.systemKey) : null);
      if (!accountId) throw new BadRequestException('accountId 누락');
      const ld = { ...dims, ...(l.dims ?? {}) };
      lines.push({ accountId, debit: l.debit ?? 0n, credit: l.credit ?? 0n, bankAccountId: l.bankAccountId ?? null, memo: l.memo ?? null, businessTypeId: ld.businessTypeId ?? null, departmentId: ld.departmentId ?? null, projectId: ld.projectId ?? null, ownerUserId: ld.ownerUserId ?? null });
    }
    const dr = lines.reduce((a, l) => a + BigInt(l.debit as bigint), 0n); const cr = lines.reduce((a, l) => a + BigInt(l.credit as bigint), 0n);
    if (dr !== cr) throw new BadRequestException(`차변(${dr})과 대변(${cr})이 일치하지 않습니다`);
    if (dr === 0n) throw new BadRequestException('금액이 0입니다');

    // 현금 라인 검증
    const cashAcc = await this.prisma.account.findUnique({ where: { companyId_systemKey: { companyId: user.companyId, systemKey: 'CASH_BANK' } } });
    const cashLines = lines.filter((l) => l.accountId === cashAcc?.id);
    for (const cl of cashLines) if (!cl.bankAccountId) throw new BadRequestException('보통예금 라인에는 bankAccountId가 필요합니다');
    if (d.bankTransactionId && cashLines.length !== 1) throw new BadRequestException('은행거래 분류 시 현금 라인은 정확히 1개여야 합니다');

    const entry = await this.prisma.$transaction(async (tx) => {
      const e = await tx.journalEntry.create({
        data: { companyId: user.companyId, entryDate: toDateOnly(d.entryDate), type: d.type, source: d.bankTransactionId ? 'BANK' : 'MANUAL', partnerId: d.partnerId ?? null, memo: d.memo ?? null, createdById: user.id, lines: { create: lines } },
        include: { lines: true },
      });
      // 은행 원본 연결 또는 수기 은행거래 생성 (원장의 현금과 계좌잔액을 항상 일치시킴)
      for (const cl of cashLines) {
        const dir = BigInt(cl.debit as bigint) > 0n ? 'IN' : 'OUT'; const amount = dir === 'IN' ? BigInt(cl.debit as bigint) : BigInt(cl.credit as bigint);
        if (d.bankTransactionId) {
          const bt = await tx.bankTransaction.findUnique({ where: { id: d.bankTransactionId }, include: { classification: true } });
          if (!bt) throw new NotFoundException('은행거래 없음');
          if (bt.classification?.status === 'CLASSIFIED') throw new BadRequestException('이미 분류된 은행거래입니다');
          if (bt.bankAccountId !== cl.bankAccountId || bt.direction !== dir || bt.amount !== amount) throw new BadRequestException(`은행거래(${bt.direction} ${bt.amount})와 분개 현금라인(${dir} ${amount})이 일치하지 않습니다`);
          await tx.bankTxnClassification.upsert({ where: { bankTransactionId: bt.id }, update: { journalEntryId: e.id, status: 'CLASSIFIED', classifiedById: user.id, classifiedAt: new Date() }, create: { bankTransactionId: bt.id, journalEntryId: e.id, status: 'CLASSIFIED', classifiedById: user.id, classifiedAt: new Date() } });
        } else {
          const bt = await tx.bankTransaction.create({ data: { bankAccountId: cl.bankAccountId!, txnAt: new Date(`${d.entryDate}T12:00:00+09:00`), direction: dir, amount, counterpartyRaw: null, descriptionRaw: `[수기] ${d.type} ${d.memo ?? ''}`.trim(), source: 'MANUAL' } });
          await tx.bankTxnClassification.create({ data: { bankTransactionId: bt.id, journalEntryId: e.id, status: 'CLASSIFIED', classifiedById: user.id, classifiedAt: new Date() } });
        }
      }
      await this.audit.log({ companyId: user.companyId, actorId: user.id, entity: 'JournalEntry', entityId: e.id, action: 'CREATE', after: { type: d.type, entryDate: d.entryDate, amount: d.amount, dims } }, tx);
      return e;
    });
    return this.get(user, entry.id);
  }

  async get(user: AuthUser, id: string) {
    const s = await this.scope.resolve(user);
    const e = await this.prisma.journalEntry.findFirst({ where: { id, companyId: user.companyId, deletedAt: null, lines: { some: this.scope.lineWhere(s) } }, include: { partner: true, lines: { include: { account: true, businessType: true, department: true, project: { select: { id: true, name: true, code: true } }, bankAccount: { select: { id: true, alias: true } } } }, bankClassifications: { include: { bankTransaction: true } } } });
    if (!e) throw new NotFoundException();
    return e;
  }

  async list(user: AuthUser, q: { from?: string; to?: string; type?: string; businessTypeId?: string; departmentId?: string; projectId?: string; accountId?: string; plSection?: string; take?: number; skip?: number }) {
    const s = await this.scope.resolve(user);
    const lineFilter: Prisma.JournalLineWhereInput = { ...this.scope.lineWhere(s), businessTypeId: q.businessTypeId, departmentId: q.departmentId, projectId: q.projectId, accountId: q.accountId, ...(q.plSection ? { account: { plSection: q.plSection as any } } : {}) };
    const where: Prisma.JournalEntryWhereInput = {
      companyId: user.companyId, deletedAt: null, status: 'POSTED', type: q.type,
      entryDate: { gte: q.from ? toDateOnly(q.from) : undefined, lte: q.to ? toDateOnly(q.to) : undefined },
      lines: { some: lineFilter },
    };
    const [rows, total] = await Promise.all([
      this.prisma.journalEntry.findMany({ where, include: { partner: { select: { name: true } }, lines: { include: { account: { select: { code: true, name: true, plSection: true, category: true } }, department: { select: { name: true } }, project: { select: { name: true } }, businessType: { select: { name: true } } } } }, orderBy: [{ entryDate: 'desc' }, { entryNo: 'desc' }], take: q.take ?? 50, skip: q.skip ?? 0 }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return { total, rows };
  }

  /** 취소(VOID) — Hard delete 금지. 연결된 수기 은행거래는 반대 거래를 INSERT 하여 잔액을 되돌린다. */
  async void(user: AuthUser, id: string, reason: string) {
    const s = await this.scope.resolve(user);
    if (!s.isAdmin) throw new ForbiddenException();
    if (!reason) throw new BadRequestException('취소 사유가 필요합니다');
    const e = await this.get(user, id);
    if (e.status === 'VOID') throw new BadRequestException('이미 취소된 거래');
    await this.prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({ where: { id }, data: { status: 'VOID' } });
      for (const c of e.bankClassifications) {
        const bt = c.bankTransaction;
        if (bt.source === 'MANUAL') {
          const rev = await tx.bankTransaction.create({ data: { bankAccountId: bt.bankAccountId, txnAt: new Date(), direction: bt.direction === 'IN' ? 'OUT' : 'IN', amount: bt.amount, descriptionRaw: `[취소] entry#${e.entryNo}: ${reason}`, source: 'SYSTEM' } });
          await tx.bankTxnClassification.create({ data: { bankTransactionId: rev.id, status: 'IGNORED', classifiedById: user.id, classifiedAt: new Date() } });
          await tx.bankTxnClassification.update({ where: { bankTransactionId: bt.id }, data: { status: 'IGNORED' } });
        } else {
          await tx.bankTxnClassification.update({ where: { bankTransactionId: bt.id }, data: { status: 'UNCLASSIFIED', journalEntryId: null } });
        }
      }
      await this.audit.log({ companyId: user.companyId, actorId: user.id, entity: 'JournalEntry', entityId: id, action: 'VOID', before: { status: 'POSTED' }, after: { status: 'VOID' }, reason }, tx);
    });
    return this.get(user, id);
  }
}
