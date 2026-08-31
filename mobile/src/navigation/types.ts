import type { CardExpense } from '../api/types';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  ExpenseDetail: { expense: CardExpense };
  ChangePassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Submit: undefined;
  Approvals: undefined;
  Profile: undefined;
};
