import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { recentMonths } from '../lib/dates';
import type {
  BankAccount,
  BankTransaction,
  BreakdownRow,
  CardExpense,
  CodeValue,
  CorporateCard,
  Dashboard,
  EntryType,
  ExpenseList,
  JournalEntry,
  Notice,
  PlannedIncome,
  PlannedPayment,
  Pnl,
  Project,
  Reserve,
  Task,
  UserRow,
  WorkLog,
} from './types';

/**
 * 조회 훅 — 목록은 캐시(AsyncStorage 영속)돼 오프라인에서도 마지막 조회 내용을 보여준다.
 * 쓰기(제출·승인)는 훅이 아니라 화면에서 직접 부른다: 자동 재시도 금지(중복 위험).
 */

export const qk = {
  cards: ['cards'] as const,
  unsubmitted: ['expenses', 'unsubmitted'] as const,
  allExpenses: ['expenses', 'all'] as const,
  openExpenses: ['expenses', 'open'] as const,
  bankTxns: ['bank-transactions'] as const,
  expenseAnalysis: (from: string, to: string) => ['expense-analysis', from, to] as const,
  submitted: ['expenses', 'submitted'] as const,
  codeValues: ['code-values'] as const,
  dashboard: ['dashboard'] as const,
  notice: ['notice'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  tasks: (id: string) => ['projects', id, 'tasks'] as const,
};

/** EXCLUDED·취소 건은 사용자에게 보여주지 않는다 */
export const visibleRows = (rows: CardExpense[] | undefined): CardExpense[] =>
  (rows ?? []).filter((r) => !r.isCancelled && r.status !== 'EXCLUDED');

export const useCards = () =>
  useQuery({ queryKey: qk.cards, queryFn: () => api.get<CorporateCard[]>('/cards') });

/** 미제출 = PENDING + 반려(REJECTED, 재제출 대상) */
export const useUnsubmitted = () =>
  useQuery({
    queryKey: qk.unsubmitted,
    queryFn: () => api.get<ExpenseList>('/cards/expenses?status=PENDING,REJECTED&take=200'),
  });

/** 카드지출 전체 내역 — 지출 탭 카드 페이지. status 없이 부르면 전 상태가 온다 */
export const useAllCardExpenses = () =>
  useQuery({
    queryKey: qk.allExpenses,
    queryFn: () => api.get<ExpenseList>('/cards/expenses?take=300'),
  });

/** 계좌 입출금 내역 — 지출 탭 계좌 페이지. 대표 전용(그 외 403)이라 isCeo일 때만 켠다 */
export const useBankTransactions = (enabled: boolean) =>
  useQuery({
    queryKey: qk.bankTxns,
    queryFn: () => api.get<BankTransaction[]>('/treasury/bank-transactions?take=300'),
    enabled,
  });

/**
 * 지출 분석용 원자료 — 지난달 1일 ~ 오늘. 웹 ExpenseAnalysis와 같은 구간·같은 엔드포인트.
 * 계좌 출금은 대표에게만 합산된다(그 외에는 403이라 아예 부르지 않는다).
 */
export const useExpenseFlows = (from: string, to: string, isCeo: boolean) =>
  useQuery({
    queryKey: qk.expenseAnalysis(from, to),
    queryFn: async () => {
      const [cards, bank] = await Promise.all([
        api.get<ExpenseList>(`/cards/expenses?from=${from}&to=${to}&take=1000`),
        isCeo
          ? api.get<BankTransaction[]>(
              `/treasury/bank-transactions?from=${from}&to=${to}&direction=OUT&take=1000`,
            )
          : Promise.resolve([] as BankTransaction[]),
      ]);
      return { cards: cards.rows, bank };
    },
  });

/** 승인 대기 (웹 알림 벨과 같은 데이터) — 60초 폴링이라 웹에서 승인하면 앱도 따라 준다 */
export const useSubmitted = (enabled: boolean) =>
  useQuery({
    queryKey: qk.submitted,
    queryFn: () => api.get<ExpenseList>('/cards/expenses?status=SUBMITTED&take=200'),
    enabled,
    refetchInterval: 60_000,
  });

/**
 * 승인함 목록 — 아직 승인되지 않은 모든 건(미제출·승인 대기·반려).
 * 대표는 용도만 있으면 미제출 건도 바로 승인할 수 있어서(API confirm은 SUBMITTED를 요구하지 않음)
 * 처리할 것을 한 곳에서 다 본다.
 */
export const useOpenExpenses = (enabled: boolean) =>
  useQuery({
    queryKey: qk.openExpenses,
    queryFn: () => api.get<ExpenseList>('/cards/expenses?status=PENDING,SUBMITTED,REJECTED&take=200'),
    enabled,
    refetchInterval: 60_000,
  });

/** 웹 cards/page.tsx의 DEFAULT_PURPOSES와 동일 — 코드값(CARD_PURPOSE)이 비어 있을 때의 기본 목록 */
export const DEFAULT_PURPOSES = [
  '식비', '회식비', '업무교통비', '야근교통비', '국내출장비', '국외출장비', '접대비',
  '유류비', '교육훈련비', '도서구입비', '정기구독료', '회의비', '사무용품비', '소모품비',
  'IT솔루션', '서류발급비', '온라인 마케팅', '광고비', '판촉물제작비', '기타비용', '오사용',
];

export const usePurposes = () => {
  const q = useQuery({ queryKey: qk.codeValues, queryFn: () => api.get<CodeValue[]>('/code-values') });
  const fromCodes = (q.data ?? []).filter((c) => c.kind === 'CARD_PURPOSE').map((c) => c.label);
  return { ...q, purposes: fromCodes.length ? fromCodes : DEFAULT_PURPOSES };
};

/**
 * 대시보드 — 이 한 번의 호출로 권한별 화면이 결정된다 (웹과 동일 패턴).
 * 응답에 pnl 키가 있으면 CEO/ADMIN, treasury 키가 있으면 CEO. 없으면 렌더하지 않는다.
 */
export const useDashboard = () =>
  useQuery({ queryKey: qk.dashboard, queryFn: () => api.get<Dashboard>('/metrics/dashboard') });

/** 오늘의 공지 — 없으면 null */
export const useNotice = () =>
  useQuery({ queryKey: qk.notice, queryFn: () => api.get<Notice | null>('/notices/today') });

/** 프로젝트 목록 — 서버가 내 범위(부서·참여)로 좁혀 준다 */
export const useProjects = () =>
  useQuery({ queryKey: qk.projects, queryFn: () => api.get<Project[]>('/projects') });

export const useProject = (id: string) =>
  useQuery({ queryKey: qk.project(id), queryFn: () => api.get<Project>(`/projects/${id}`) });

export const useTasks = (projectId: string) =>
  useQuery({ queryKey: qk.tasks(projectId), queryFn: () => api.get<Task[]>(`/projects/${projectId}/tasks`) });

// ───── 내 업무 (웹 my/page.tsx와 동일한 API) ─────

/** scope: 'me' | 'all' | <userId> — 웹과 같은 규칙. all/개인별은 대표 전용 */
const scopeQuery = (scope: string): string =>
  scope === 'me' ? '' : scope === 'all' ? '?scope=all' : `?userId=${scope}`;
const scopeAnd = (scope: string): string =>
  scope === 'me' ? '' : scope === 'all' ? '&scope=all' : `&userId=${scope}`;

export const useMyTasks = (scope: string) =>
  useQuery({
    queryKey: ['tasks', 'my', scope],
    queryFn: () => api.get<Task[]>(`/tasks/my${scopeQuery(scope)}`),
  });

/** 특정 날짜의 업무 일지 */
export const useWorkLogsOfDay = (date: string, scope: string) =>
  useQuery({
    queryKey: ['worklogs', scope, 'day', date],
    queryFn: () => api.get<WorkLog[]>(`/worklogs?date=${date}${scopeAnd(scope)}`),
  });

/** 기간(월)의 업무 일지 — 캘린더 표시용 */
export const useWorkLogsOfRange = (from: string, to: string, scope: string) =>
  useQuery({
    queryKey: ['worklogs', scope, 'range', from, to],
    queryFn: () => api.get<WorkLog[]>(`/worklogs?from=${from}&to=${to}${scopeAnd(scope)}`),
  });

/** 직원 목록 — 대표의 개인별 보기용 */
export const useUsers = (enabled: boolean) =>
  useQuery({ queryKey: ['users'], queryFn: () => api.get<UserRow[]>('/users'), enabled });

// ───── 손익·거래·자금 (경영 메뉴 — 웹과 동일 API) ─────

/** 손익계산서 — CEO/ADMIN 전용(그 외 403). yoy면 전년 동기가 붙는다 */
export const usePnl = (from: string, to: string, yoy: boolean, enabled: boolean) =>
  useQuery({
    queryKey: ['pnl', from, to, yoy],
    queryFn: () => api.get<Pnl>(`/metrics/pnl?preset=custom&from=${from}&to=${to}${yoy ? '&yoy=1' : ''}`),
    enabled,
  });

export const usePnlBreakdown = (from: string, to: string, groupBy: string, enabled: boolean) =>
  useQuery({
    queryKey: ['pnl-breakdown', from, to, groupBy],
    queryFn: () =>
      api.get<{ rows: BreakdownRow[] }>(`/metrics/pnl/breakdown?preset=custom&from=${from}&to=${to}&groupBy=${groupBy}`),
    enabled,
  });

/** 거래 목록 — CEO/ADMIN 전용 */
export const useJournal = (from: string, to: string, type: string, enabled: boolean) =>
  useQuery({
    queryKey: ['journal', from, to, type],
    queryFn: () =>
      api.get<{ total: number; rows: JournalEntry[] }>(
        `/journal?from=${from}&to=${to}&take=100${type ? `&type=${type}` : ''}`,
      ),
    enabled,
  });

export const useEntryTypes = (enabled: boolean) =>
  useQuery({ queryKey: ['entry-types'], queryFn: () => api.get<EntryType[]>('/journal/entry-types'), enabled });

/** 자금 — 전부 CEO 전용(그 외 403이라 isCeo일 때만 켠다) */
export const useBankAccounts = (enabled: boolean) =>
  useQuery({ queryKey: ['bank-accounts'], queryFn: () => api.get<BankAccount[]>('/treasury/bank-accounts'), enabled });

export const useReserves = (enabled: boolean) =>
  useQuery({ queryKey: ['reserves'], queryFn: () => api.get<Reserve[]>('/treasury/reserves'), enabled });

export const usePlannedIncomes = (enabled: boolean) =>
  useQuery({
    queryKey: ['planned-incomes'],
    queryFn: () => api.get<PlannedIncome[]>('/treasury/planned-incomes'),
    enabled,
  });

export const usePlannedPayments = (enabled: boolean) =>
  useQuery({
    queryKey: ['planned-payments'],
    queryFn: () => api.get<PlannedPayment[]>('/treasury/planned-payments'),
    enabled,
  });

/** 최근 6개월 월별 손익 — 손익 추이 그래프용. CEO/ADMIN 전용(/metrics/pnl이 403이면 비활성) */
export const useMonthlyPnl = (enabled: boolean) =>
  useQuery({
    queryKey: ['pnl', 'monthly'],
    enabled,
    queryFn: async () => {
      const months = recentMonths(6);
      const results = await Promise.all(
        months.map((mo) =>
          api.get<{ sales: string; operatingProfit: string }>(
            `/metrics/pnl?preset=custom&from=${mo.from}&to=${mo.to}`,
          ),
        ),
      );
      // 화면은 왼→오 시간순이 자연스러우니 과거가 앞이 되게 뒤집는다
      return months
        .map((mo, i) => ({ short: mo.short, sales: results[i].sales, operatingProfit: results[i].operatingProfit }))
        .reverse();
    },
  });

/** 코드값 라벨 — 프로젝트/태스크 상태 표기는 설정의 코드값을 따른다 (웹 labelOf와 동일) */
export const useCodeLabel = () => {
  const q = useQuery({ queryKey: qk.codeValues, queryFn: () => api.get<CodeValue[]>('/code-values') });
  return (kind: string, code: string): string =>
    (q.data ?? []).find((c) => c.kind === kind && c.code === code)?.label ?? code;
};

/** 제출·승인 뒤 목록들을 다시 불러온다 */
export const useInvalidateExpenses = () => {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.cards }),
      qc.invalidateQueries({ queryKey: qk.unsubmitted }),
      qc.invalidateQueries({ queryKey: qk.submitted }),
      qc.invalidateQueries({ queryKey: qk.allExpenses }),
      qc.invalidateQueries({ queryKey: qk.openExpenses }),
    ]);
};
