import { Injectable } from '@nestjs/common';
import { PlSection, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../common/scope/scope.service';
import { TreasuryService } from '../treasury/treasury.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { pct, sum } from '../common/money';
import { Preset, resolveRange, seoulDayRange, toDateOnly, todaySeoul } from '../common/dates';
import { progressOf } from '../projects/projects.service';

export type ScopeSel = { businessTypeId?: string; departmentId?: string; projectId?: string };
export type GroupBy = 'businessType' | 'department' | 'project' | 'account';

/**
 * ★ 모든 Dashboard 숫자의 단일 계산 지점.
 * 화면마다 계산을 따로 구현하지 않는다. 손익 = 원장(JournalLine) / 자금 = 은행거래(BankTransaction).
 */
@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService, private scope: ScopeService, private treasury: TreasuryService) {}

  // ───────── 손익 ─────────
  private async lineWhere(user: AuthUser, sel: ScopeSel, from: string, to: string): Promise<Prisma.JournalLineWhereInput> {
    const s = await this.scope.resolve(user);
    return {
      ...this.scope.lineWhere(s),
      businessTypeId: sel.businessTypeId, departmentId: sel.departmentId, projectId: sel.projectId,
      entry: { companyId: user.companyId, status: 'POSTED', deletedAt: null, entryDate: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      account: { category: { in: ['REVENUE', 'EXPENSE'] } },
    };
  }

  /** plSection별 합계 → 손익구조 */
  private buildPnl(rows: { plSection: PlSection; category: string; debit: bigint; credit: bigint }[]) {
    const by: Record<string, bigint> = {};
    for (const r of rows) {
      const signed = r.category === 'REVENUE' ? r.credit - r.debit : r.debit - r.credit;
      by[r.plSection] = (by[r.plSection] ?? 0n) + signed;
    }
    const sales = by.SALES ?? 0n, cogs = by.COGS ?? 0n, sga = by.SGA ?? 0n, noi = by.NON_OP_INCOME ?? 0n, noe = by.NON_OP_EXPENSE ?? 0n, tax = by.INCOME_TAX ?? 0n;
    const grossProfit = sales - cogs; const operatingProfit = grossProfit - sga; const preTax = operatingProfit + noi - noe; const netIncome = preTax - tax;
    return {
      sales, cogs, grossProfit, sga, operatingProfit, nonOpIncome: noi, nonOpExpense: noe, preTaxIncome: preTax, incomeTax: tax, netIncome,
      grossMarginPct: pct(grossProfit, sales), operatingMarginPct: pct(operatingProfit, sales), netMarginPct: pct(netIncome, sales),
    };
  }

  async pnl(user: AuthUser, sel: ScopeSel, preset?: Preset, from?: string, to?: string, compareYoY = false) {
    const range = resolveRange(preset, from, to);
    const calc = async (f: string, t: string) => {
      const where = await this.lineWhere(user, sel, f, t);
      const g = await this.prisma.journalLine.groupBy({ by: ['accountId'], where, _sum: { debit: true, credit: true } });
      const accs = await this.prisma.account.findMany({ where: { id: { in: g.map((x) => x.accountId) } } });
      return this.buildPnl(g.map((x) => { const a = accs.find((y) => y.id === x.accountId)!; return { plSection: a.plSection, category: a.category, debit: x._sum.debit ?? 0n, credit: x._sum.credit ?? 0n }; }));
    };
    const current = await calc(range.from, range.to);
    let previousYear: any = null;
    if (compareYoY) { const py = (d: string) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`; previousYear = await calc(py(range.from), py(range.to)); }
    return { range, ...current, previousYear };
  }

  /** Drill down: 사업 / 부서 / 프로젝트 / 계정과목 별 손익 */
  async pnlBreakdown(user: AuthUser, sel: ScopeSel, groupBy: GroupBy, preset?: Preset, from?: string, to?: string) {
    const range = resolveRange(preset, from, to);
    const where = await this.lineWhere(user, sel, range.from, range.to);
    const dimKey = ({ businessType: 'businessTypeId', department: 'departmentId', project: 'projectId', account: 'accountId' } as const)[groupBy];
    const g = (await (this.prisma.journalLine.groupBy as any)({ by: [dimKey, 'accountId'], where, _sum: { debit: true, credit: true } })) as any[];
    const accs = await this.prisma.account.findMany({ where: { id: { in: g.map((x) => x.accountId) } } });
    const groups = new Map<string | null, any[]>();
    for (const x of g) { const k = x[dimKey] ?? null; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(x); }
    const names = new Map<string, string>();
    if (groupBy === 'businessType') (await this.prisma.businessType.findMany({ where: { companyId: user.companyId } })).forEach((r) => names.set(r.id, r.name));
    if (groupBy === 'department') (await this.prisma.department.findMany({ where: { companyId: user.companyId } })).forEach((r) => names.set(r.id, r.name));
    if (groupBy === 'project') (await this.prisma.project.findMany({ where: { companyId: user.companyId } })).forEach((r) => names.set(r.id, `${r.code} ${r.name}`));
    if (groupBy === 'account') accs.forEach((r) => names.set(r.id, `${r.code} ${r.name}`));
    const rows = [...groups.entries()].map(([k, xs]) => ({
      id: k, name: k ? names.get(k) ?? k : '(미지정)',
      ...this.buildPnl(xs.map((x) => { const a = accs.find((y) => y.id === x.accountId)!; return { plSection: a.plSection, category: a.category, debit: x._sum.debit ?? 0n, credit: x._sum.credit ?? 0n }; })),
    }));
    rows.sort((a, b) => (b.sales > a.sales ? 1 : b.sales < a.sales ? -1 : 0));
    return { range, groupBy, rows };
  }

  // ───────── 자금 ─────────
  async treasuryKpi(user: AuthUser) {
    this.scope.assertTreasury(user);
    const cid = user.companyId;
    const accounts = await this.treasury.balances(cid);
    const totalBalance = sum(accounts.map((a) => a.balance));
    const restrictedBalance = sum(accounts.filter((a) => a.isRestricted).map((a) => a.balance));
    const reserves = await this.prisma.cashReserve.aggregate({ where: { companyId: cid, status: 'ACTIVE' }, _sum: { amount: true } });
    const reserveTotal = reserves._sum.amount ?? 0n;
    const planned = await this.prisma.plannedPayment.groupBy({ by: ['kind'], where: { companyId: cid, status: 'SCHEDULED' }, _sum: { amount: true } });
    const plannedConfirmed = planned.find((p) => p.kind === 'CONFIRMED')?._sum.amount ?? 0n;
    const plannedPlanned = planned.find((p) => p.kind === 'PLANNED')?._sum.amount ?? 0n;
    // 오늘 실제 입출금 (취소/반대거래(IGNORED)는 제외)
    const { start, end } = seoulDayRange(todaySeoul());
    const today = await this.prisma.bankTransaction.groupBy({ by: ['direction'], where: { bankAccount: { companyId: cid }, txnAt: { gte: start, lt: end }, NOT: { classification: { status: 'IGNORED' } } }, _sum: { amount: true } });
    const todayIn = today.find((t) => t.direction === 'IN')?._sum.amount ?? 0n;
    const todayOut = today.find((t) => t.direction === 'OUT')?._sum.amount ?? 0n;
    // 가용현금 = 총잔액 − 유보금 − 확정 지급예정 − 사용제한계좌 잔액 (계산 조건은 향후 설정으로 확장)
    const unavailable = reserveTotal + plannedConfirmed;
    const availableCash = totalBalance - unavailable - restrictedBalance;
    // 단순 예측: 현재 가용잔액 − 기간 내 지급예정(확정+계획). 입금예정(채권)은 MVP2에서 반영.
    const forecast = async (days: number) => {
      const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const due = await this.prisma.plannedPayment.aggregate({ where: { companyId: cid, status: 'SCHEDULED', dueDate: { lte: toDateOnly(until) } }, _sum: { amount: true } });
      return totalBalance - (due._sum.amount ?? 0n);
    };
    return {
      totalBalance, restrictedBalance, reserveTotal, plannedConfirmed, plannedPlanned, unavailable, availableCash,
      todayIn, todayOut, todayNet: todayIn - todayOut,
      forecast: { d7: await forecast(7), d30: await forecast(30), d90: await forecast(90) },
      accounts: accounts.map((a) => ({ id: a.id, alias: a.alias, bankName: a.bankName, balance: a.balance, isRestricted: a.isRestricted, department: a.department?.name ?? null })),
    };
  }

  // ───────── 프로젝트 ─────────
  async projectsKpi(user: AuthUser, sel: ScopeSel) {
    const s = await this.scope.resolve(user);
    const rows = await this.prisma.project.findMany({
      where: { companyId: user.companyId, deletedAt: null, ...this.scope.projectWhere(s), businessTypeId: sel.businessTypeId, ...(sel.departmentId ? { departments: { some: { departmentId: sel.departmentId } } } : {}), ...(sel.projectId ? { id: sel.projectId } : {}) },
      select: { id: true, code: true, name: true, status: true, planEndDate: true, tasks: { where: { deletedAt: null }, select: { isDone: true, weight: true } } },
    });
    const today = todaySeoul(); const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const list = rows.map((p) => { const pr = progressOf(p.tasks); const end = p.planEndDate?.toISOString().slice(0, 10); const open = !['DONE', 'CANCELLED'].includes(p.status); return { id: p.id, code: p.code, name: p.name, status: p.status, planEndDate: end, ...pr, isDelayed: open && !!end && end < today, isAtRisk: open && !!end && end <= soon && pr.progress < 80 }; });
    const total = list.length, active = list.filter((p) => p.status === 'ACTIVE').length;
    const all = progressOf(rows.flatMap((p) => p.tasks));
    return { total, active, delayed: list.filter((p) => p.isDelayed).length, atRisk: list.filter((p) => p.isAtRisk).length, taskCompletionPct: all.progress, projects: list };
  }

  /**
   * 프로젝트별 자금 요약 — 대시보드 보드의 '예상수익' 토글용.
   * 받은돈/나간돈 = 현금계좌(CASH_BANK) 라인의 입/출금, 받을돈 = 매출채권(AR) 잔액,
   * 나갈돈 = 미지급금(AP) 잔액 + 지급예정(SCHEDULED), 예상수익 = 받은돈+받을돈−나간돈−나갈돈.
   */
  async projectsFinance(user: AuthUser) {
    const s = await this.scope.resolve(user);
    const g = await this.prisma.journalLine.groupBy({
      by: ['projectId', 'accountId'],
      where: {
        ...this.scope.lineWhere(s),
        projectId: { not: null },
        entry: { companyId: user.companyId, status: 'POSTED', deletedAt: null },
      },
      _sum: { debit: true, credit: true },
    });
    const accs = await this.prisma.account.findMany({ where: { companyId: user.companyId, systemKey: { in: ['CASH_BANK', 'AR', 'AP'] } } });
    const keyOf = new Map(accs.map((a) => [a.id, a.systemKey!]));
    const out = new Map<string, { received: bigint; receivable: bigint; paid: bigint; payable: bigint }>();
    const at = (id: string) => { let o = out.get(id); if (!o) { o = { received: 0n, receivable: 0n, paid: 0n, payable: 0n }; out.set(id, o); } return o; };
    for (const x of g) {
      const k = keyOf.get(x.accountId); if (!k) continue;
      const d = x._sum.debit ?? 0n, c = x._sum.credit ?? 0n; const o = at(x.projectId!);
      if (k === 'CASH_BANK') { o.received += d; o.paid += c; }
      else if (k === 'AR') o.receivable += d - c;
      else if (k === 'AP') o.payable += c - d;
    }
    const planned = await this.prisma.plannedPayment.groupBy({ by: ['projectId'], where: { companyId: user.companyId, status: 'SCHEDULED', projectId: { not: null } }, _sum: { amount: true } });
    for (const p of planned) at(p.projectId!).payable += p._sum.amount ?? 0n;
    return Object.fromEntries([...out].map(([id, o]) => [id, { ...o, expectedProfit: o.received + o.receivable - o.paid - o.payable }]));
  }

  /** 대표 Dashboard 한 번에 (Role별로 노출 범위 다름) */
  async dashboard(user: AuthUser, sel: ScopeSel, preset?: Preset, from?: string, to?: string) {
    const roles = user.roles.map((r) => r.role);
    const out: any = { scope: sel, generatedAt: new Date().toISOString() };
    if (roles.includes(Role.CEO) || roles.includes(Role.ADMIN)) {
      out.pnl = await this.pnl(user, sel, preset ?? 'this_month', from, to);
      out.byBusinessType = (await this.pnlBreakdown(user, sel, 'businessType', preset ?? 'this_month', from, to)).rows;
      out.byDepartment = (await this.pnlBreakdown(user, sel, 'department', preset ?? 'this_month', from, to)).rows;
    }
    if (roles.includes(Role.CEO)) out.treasury = await this.treasuryKpi(user);
    out.projects = await this.projectsKpi(user, sel);
    return out;
  }
}
