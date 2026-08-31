import type { CardExpense } from '../api/types';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  ExpenseDetail: { expense: CardExpense };
  ProjectDetail: { projectId: string; name?: string };
  ChangePassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Submit: undefined;
  Projects: undefined;
  Approvals: undefined;
  Profile: undefined;
};
