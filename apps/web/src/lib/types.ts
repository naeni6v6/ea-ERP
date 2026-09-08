export type Role = 'CEO' | 'ADMIN' | 'EMPLOYEE';
export type ScopeType = 'COMPANY' | 'BUSINESS_TYPE' | 'DEPARTMENT' | 'PROJECT';

export interface RoleScope {
  role: Role;
  scopeType: ScopeType;
  businessTypeId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  companyId: string;
  department?: string | null;
  roles: RoleScope[];
  effectiveScope: {
    isCeo: boolean;
    isAdmin: boolean;
    departmentIds: string[] | 'ALL';
    businessTypeIds: string[] | 'ALL';
    projectIds: string[] | 'ALL';
  };
}

export interface LoginResult {
  accessToken: string;
  user: { id: string; name: string; email: string; department: string | null; roles: RoleScope[] };
}

export interface BusinessType {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}
export interface Department {
  id: string;
  code: string;
  name: string;
  kind: 'HQ' | 'SITE';
  isActive: boolean;
}
export interface CodeValue {
  id: string;
  kind: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}
export interface Account {
  id: string;
  code: string;
  name: string;
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  plSection: 'NONE' | 'SALES' | 'COGS' | 'SGA' | 'NON_OP_INCOME' | 'NON_OP_EXPENSE' | 'INCOME_TAX';
  systemKey: string | null;
  isActive: boolean;
}
export interface Partner {
  id: string;
  name: string;
  type: 'CUSTOMER' | 'VENDOR' | 'BOTH';
}
export interface UserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  department?: { id: string; name: string } | null;
  roleScopes?: RoleScope[];
}

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
  previousYear: Pnl | null;
}

export interface BreakdownRow extends Omit<Pnl, 'range' | 'previousYear'> {
  id: string | null;
  name: string;
}

export interface TreasuryKpi {
  totalBalance: string;
  restrictedBalance: string;
  reserveTotal: string;
  plannedConfirmed: string;
  plannedPlanned: string;
  unavailable: string;
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

/** 프로젝트별 자금 요약 (metrics/projects/finance) — 금액은 BigInt 문자열 */
export interface ProjectFinance {
  received: string; // 받은돈 (현금계좌 입금)
  receivable: string; // 받을돈 (매출채권 잔액)
  paid: string; // 나간돈 (현금계좌 출금)
  payable: string; // 나갈돈 (미지급금 + 지급예정)
  expectedProfit: string; // 예상수익
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
  scope: Record<string, string | undefined>;
  generatedAt: string;
  pnl?: Pnl;
  byBusinessType?: BreakdownRow[];
  byDepartment?: BreakdownRow[];
  treasury?: TreasuryKpi;
  projects: ProjectsKpi;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  priority: string;
  goal: string | null;
  description: string | null;
  startDate: string | null;
  planEndDate: string | null;
  actualEndDate: string | null;
  contractAmount: string;
  expectedRevenue: string;
  budgetAmount: string;
  targetCost: string;
  targetProfit: string;
  financeVisibleToMembers: boolean;
  sortOrder: number;
  businessTypeId: string;
  leadDepartmentId: string;
  ownerUserId: string | null;
  businessType?: BusinessType;
  leadDepartment?: Department;
  owner?: { id: string; name: string } | null;
  departments?: { departmentId: string; isLead: boolean; department: Department }[];
  members?: { userId: string; roleInProject: string; user: { id: string; name: string; email: string } }[];
  totalTasks: number;
  doneTasks: number;
  progress: number;
  isDelayed: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assignee?: { id: string; name: string } | null;
  project?: { id: string; name: string; code: string };
  dueDate: string | null;
  priority: string;
  status: string;
  isDone: boolean;
  /** 완료 처리 시각 — 일별 완료 현황 차트용 */
  doneAt: string | null;
  weight: number;
  sortOrder: number;
}

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

export interface BankAccount {
  id: string;
  bankName: string;
  alias: string;
  accountNoMasked: string | null;
  purpose: string;
  isRestricted: boolean;
  isActive: boolean;
  openingBalance: string;
  openingDate: string;
  balance: string;
  department?: { name: string } | null;
  departmentId: string | null;
  /** 팝빌 계좌조회 연동 — 둘 다 있어야 동기화 대상 */
  popbillBankCode: string | null;
  popbillAccountNumber: string | null;
  popbillSyncedAt: string | null;
}

/** 팝빌 연동 설정 상태 */
export interface PopbillStatus {
  configured: boolean;
  isTest: boolean;
  corpNum: string | null;
}

/** 계좌 1건 동기화 결과 */
export interface PopbillSyncResult {
  bankAccountId: string;
  alias: string;
  from?: string;
  to?: string;
  total?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  txnAt: string;
  direction: 'IN' | 'OUT';
  amount: string;
  counterpartyRaw: string | null;
  descriptionRaw: string | null;
  source: string;
  /** 용도 — 카드 지출과 같은 용도 목록에서 선택 (급여비·프로젝트비 등) */
  purposeText?: string | null;
  memo?: string | null;
  /** 비용 계정과목 — 카드 지출과 같은 분류 축 */
  accountId?: string | null;
  account?: { id: string; name: string } | null;
  bankAccount?: { alias: string; bankName: string };
  classification?: {
    status: 'UNCLASSIFIED' | 'CLASSIFIED' | 'IGNORED';
    journalEntry?: { id: string; entryNo: number; type: string; memo: string | null } | null;
  } | null;
}

export type CardExpenseStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'EXCLUDED';

export interface CorporateCard {
  id: string;
  name: string;
  issuer: string;
  cardType: 'CREDIT' | 'CHECK';
  last4: string | null;
  holderUserId: string | null;
  bankAccountId: string | null;
  source: 'GOWID' | 'BANK' | 'MANUAL';
  isActive: boolean;
  /** 월 한도(원, 정수 문자열). null이면 한도 미설정 */
  monthlyLimit?: string | null;
  /** 이번 달 이용금액(원, 정수 문자열) — 취소·제외 건 제외 합계 */
  monthUsed?: string;
  holder?: { id: string; name: string } | null;
  bankAccount?: { id: string; alias: string; bankName: string } | null;
  pendingCount: number;
}

export interface CardExpense {
  id: string;
  cardId: string;
  usedAt: string;
  amount: string;
  currency: string;
  storeName: string | null;
  approvalNo: string | null;
  isCancelled: boolean;
  status: CardExpenseStatus;
  purposeText: string | null;
  memo: string | null;
  rejectReason: string | null;
  purposeAt: string | null;
  confirmedAt: string | null;
  source: 'GOWID' | 'BANK' | 'MANUAL';
  accountId: string | null;
  projectId: string | null;
  departmentId: string | null;
  businessTypeId: string | null;
  journalEntryId: string | null;
  card?: {
    id: string;
    name: string;
    last4: string | null;
    cardType: 'CREDIT' | 'CHECK';
    holder?: { id: string; name: string } | null;
  };
  account?: { id: string; code: string; name: string } | null;
  project?: { id: string; code: string; name: string } | null;
  department?: { id: string; name: string } | null;
  journalEntry?: { id: string; entryNo: number; status: string } | null;
}

export interface CardExpenseList {
  summary: Record<
    'all' | 'notSubmitted' | 'submitted' | 'confirmed' | 'excluded',
    { count: number; amount: string }
  >;
  rows: CardExpense[];
}

export interface Reserve {
  id: string;
  category: string;
  purpose: string;
  amount: string;
  status: 'ACTIVE' | 'RELEASED';
  memo: string | null;
  createdAt: string;
  movements: { id: string; type: string; amount: string; reason: string | null; createdAt: string }[];
}

/** 입금 예정(들어올 돈) — 자금 달력 */
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

/** 일일 업무 일지 — 사람·날짜당 1건 */
export interface WorkLog {
  id: string;
  logDate: string;
  content: string;
  updatedAt: string;
  user?: { id: string; name: string };
}

/** 오늘의 공지 — 대시보드 상단 현수막 배너 */
export interface Notice {
  id: string;
  noticeDate: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  reason: string | null;
  createdAt: string;
  actor?: { name: string } | null;
  before: unknown;
  after: unknown;
}
