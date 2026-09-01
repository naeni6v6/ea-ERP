import type { CardExpense } from '../api/types';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  ExpenseDetail: { expense: CardExpense };
  ProjectDetail: { projectId: string; name?: string };
  ChangePassword: undefined;
  Profile: undefined;
  Pnl: undefined;
  Journal: undefined;
  Treasury: undefined;
  /** 아직 모바일로 안 옮긴 웹 메뉴 — 제목만 받아 준비 중 안내를 띄운다 */
  Placeholder: { title: string };
};

export type MainTabParamList = {
  Home: undefined;
  /** 지출 탭 — seg로 카드/계좌 세그먼트를 지정해 열 수 있다 (전체 메뉴에서 사용) */
  Submit: { seg?: 'card' | 'account' } | undefined;
  Projects: undefined;
  Approvals: undefined;
  MyTasks: undefined;
  Menu: undefined;
};
