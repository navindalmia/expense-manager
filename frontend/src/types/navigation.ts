import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Root Stack Parameter List
 * Defines all screens in the navigation stack and their parameters
 * Extends Record<string, object | undefined> for React Navigation compatibility
 */
export interface RootStackParamList extends Record<string, object | undefined> {
  Login: undefined;
  Home: undefined;
  ExpenseList: { groupId: number; groupName?: string; groupCurrencyCode?: string };
  ExpenseDetail: { expenseId: number };
  CreateExpense: { groupId: number; groupName?: string; groupCurrencyCode?: string };
  CreateGroup: undefined;
}

/**
 * Props for HomeScreen
 */
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

/**
 * Props for ExpenseListScreen
 * Uses NativeStackScreenProps for proper navigation typing
 */
export type ExpenseListScreenProps = NativeStackScreenProps<RootStackParamList, 'ExpenseList'>;

/**
 * Props for ExpenseDetailScreen
 */
export type ExpenseDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

/**
 * Props for CreateExpenseScreen
 */
export type CreateExpenseScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateExpense'>;

/**
 * Props for CreateGroupScreen
 */
export type CreateGroupScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;
