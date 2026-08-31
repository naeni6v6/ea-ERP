import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  CardExpense,
  CodeValue,
  CorporateCard,
  Dashboard,
  ExpenseList,
  Notice,
  Project,
  Task,
} from './types';

/**
 * 조회 훅 — 목록은 캐시(AsyncStorage 영속)돼 오프라인에서도 마지막 조회 내용을 보여준다.
 * 쓰기(제출·승인)는 훅이 아니라 화면에서 직접 부른다: 자동 재시도 금지(중복 위험).
 */

export const qk = {
  cards: ['cards'] as const,
  unsubmitted: ['expenses', 'unsubmitted'] as const,
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

/** 승인 대기 (CEO 승인함) */
export const useSubmitted = (enabled: boolean) =>
  useQuery({
    queryKey: qk.submitted,
    queryFn: () => api.get<ExpenseList>('/cards/expenses?status=SUBMITTED&take=200'),
    enabled,
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
    ]);
};
