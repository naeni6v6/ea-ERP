/** 서버 응답 타입 — apps/api 응답 형태와 1:1. 금액은 전부 원 단위 정수 문자열. */

export type Role = 'CEO' | 'ADMIN' | 'EMPLOYEE';

export interface RoleScope {
  id: string;
  role: Role;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
  roles: RoleScope[];
}

export interface Me {
  id: string;
  name: string;
  email: string;
  companyId: string;
  department?: { id: string; name: string } | null;
  roles: RoleScope[];
  effectiveScope: { isCeo: boolean; isAdmin: boolean };
}

export interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  user: SessionUser;
}

export interface CorporateCard {
  id: string;
  name: string;
  issuer: string;
  cardType: 'CREDIT' | 'CHECK';
  last4: string | null;
  holderUserId: string | null;
  isActive: boolean;
  /** 월 한도(원) — null이면 미설정 */
  monthlyLimit: string | null;
  /** 이번 달 이용금액(원) — 취소·제외 건 제외 */
  monthUsed: string;
  holder?: { id: string; name: string } | null;
  pendingCount: number;
}

export type CardExpenseStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'EXCLUDED';

export interface CardExpense {
  id: string;
  cardId: string;
  usedAt: string; // ISO
  amount: string; // 원 단위 정수 문자열
  storeName: string | null;
  status: CardExpenseStatus;
  purposeText: string | null;
  memo: string | null;
  rejectReason: string | null;
  isCancelled: boolean;
  card?: {
    id: string;
    name: string;
    last4: string | null;
    cardType: 'CREDIT' | 'CHECK';
    holder?: { id: string; name: string } | null;
  };
}

export interface ExpenseSummaryItem {
  count: number;
  amount: string;
}

export interface ExpenseList {
  summary: {
    all: ExpenseSummaryItem;
    notSubmitted: ExpenseSummaryItem;
    submitted: ExpenseSummaryItem;
    confirmed: ExpenseSummaryItem;
    excluded: ExpenseSummaryItem;
  };
  rows: CardExpense[];
}

/** 은행 입출금 내역 (GET /treasury/bank-transactions — 대표 전용, 웹 lib/types.ts와 동일) */
export interface BankTransaction {
  id: string;
  bankAccountId: string;
  txnAt: string; // ISO
  direction: 'IN' | 'OUT';
  amount: string;
  counterpartyRaw: string | null;
  descriptionRaw: string | null;
  source: string;
  bankAccount?: { alias: string; bankName: string };
  classification?: {
    status: 'UNCLASSIFIED' | 'CLASSIFIED' | 'IGNORED';
  } | null;
}

export interface CodeValue {
  id: string;
  kind: string;
  code: string;
  label: string;
}

export interface ConfirmBulkResult {
  requested: number;
  confirmed: number;
  skipped: number;
  errors: string[];
}

// ───── 대시보드 (GET /metrics/dashboard — 권한에 따라 pnl/treasury 키가 빠진다) ─────

export interface Pnl {
  range: { from: string; to: string };
  sales: string;
  cogs: string;
  grossProfit: string;
  sga: string;
  operatingProfit: string;
  nonOpIncome: string;
  nonOpExpense: string;
  preTaxIncome: string;
  incomeTax: string;
  netIncome: string;
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  /** yoy=1로 부르면 전년 동기가 붙는다 */
  previousYear?: Pnl;
}

/** 손익 분해(그룹별) 한 줄 — 웹 BreakdownRow와 동일 */
export interface BreakdownRow extends Omit<Pnl, 'range' | 'previousYear'> {
  id: string | null;
  name: string;
}

// ───── 거래 (GET /journal — 웹 lib/types.ts와 동일) ─────

export interface EntryType {
  type: string;
  label: string;
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  memo: string | null;
  account?: { code: string; name: string; plSection: string; category: string };
  department?: { name: string } | null;
  project?: { name: string } | null;
  businessType?: { name: string } | null;
}

export interface JournalEntry {
  id: string;
  entryNo: number;
  entryDate: string;
  type: string;
  status: 'POSTED' | 'VOID';
  source: string;
  memo: string | null;
  partner?: { name: string } | null;
  lines: JournalLine[];
}

// ───── 자금 (CEO 전용 — /treasury/*) ─────

export interface BankAccount {
  id: string;
  bankName: string;
  alias: string;
  accountNoMasked: string | null;
  purpose: string;
  isRestricted: boolean;
  isActive: boolean;
  balance: string;
  department?: { name: string } | null;
}

export interface Reserve {
  id: string;
  category: string;
  purpose: string;
  amount: string;
  status: 'ACTIVE' | 'RELEASED';
  memo: string | null;
}

export interface PlannedIncome {
  id: string;
  title: string;
  amount: string;
  dueDate: string;
  memo: string | null;
  status: 'SCHEDULED' | 'RECEIVED' | 'CANCELLED';
}

export interface PlannedPayment {
  id: string;
  kind: 'CONFIRMED' | 'PLANNED';
  title: string;
  category: string | null;
  amount: string;
  dueDate: string;
  status: 'SCHEDULED' | 'PAID' | 'CANCELLED';
  memo: string | null;
  department?: { name: string } | null;
  project?: { name: string } | null;
  businessType?: { name: string } | null;
}

export interface TreasuryKpi {
  totalBalance: string;
  reserveTotal: string;
  plannedConfirmed: string;
  availableCash: string;
  todayIn: string;
  todayOut: string;
  todayNet: string;
  forecast: { d7: string; d30: string; d90: string };
  accounts: {
    id: string;
    alias: string;
    bankName: string;
    balance: string;
    isRestricted: boolean;
    department: string | null;
  }[];
}

export interface ProjectKpiRow {
  id: string;
  code: string;
  name: string;
  status: string;
  planEndDate?: string;
  totalTasks: number;
  doneTasks: number;
  progress: number;
  isDelayed: boolean;
  isAtRisk: boolean;
}

export interface ProjectsKpi {
  total: number;
  active: number;
  delayed: number;
  atRisk: number;
  taskCompletionPct: number;
  projects: ProjectKpiRow[];
}

export interface Dashboard {
  generatedAt: string;
  pnl?: Pnl;
  treasury?: TreasuryKpi;
  projects: ProjectsKpi;
}

export interface Notice {
  id: string;
  noticeDate: string;
  content: string;
  updatedAt: string;
}

// ───── 프로젝트 ─────

export interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  goal: string | null;
  startDate: string | null;
  planEndDate: string | null;
  contractAmount: string;
  expectedRevenue: string;
  budgetAmount: string;
  targetCost: string;
  targetProfit: string;
  businessType?: { id: string; name: string };
  leadDepartment?: { id: string; name: string };
  owner?: { id: string; name: string } | null;
  departments?: { departmentId: string; isLead: boolean; department: { id: string; name: string } }[];
  members?: { userId: string; user: { id: string; name: string } }[];
  totalTasks: number;
  doneTasks: number;
  progress: number;
  isDelayed: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  assignee?: { id: string; name: string } | null;
  project?: { id: string; name: string; code: string };
  dueDate: string | null;
  status: string;
  isDone: boolean;
  /** 완료 처리 시각 — 일별 완료 현황 차트용 */
  doneAt: string | null;
}

/** 일일 업무 일지 (GET /worklogs — 웹 lib/types.ts와 동일) */
export interface WorkLog {
  id: string;
  logDate: string;
  content: string;
  updatedAt: string;
  user?: { id: string; name: string };
}

/** 직원 목록 (GET /users — CEO 전용, 내 업무의 개인별 보기용) */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  department?: { id: string; name: string } | null;
}
