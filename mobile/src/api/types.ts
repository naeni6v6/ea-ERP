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
