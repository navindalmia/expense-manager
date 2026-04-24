import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Expense } from '../services/expenseService';

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
  EditExpense: { expenseId?: number; groupId: number; groupName?: string; groupCurrencyCode?: string; currency?: { id: number; code: string; label: string } };
  CreateGroup: undefined;
  Settlement: { groupId: number; groupName?: string; currency?: { id: number; code: string; label: string }; expenses: Expense[] };
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
 * Props for EditExpenseScreen (handles both create and edit modes)
 */
export type EditExpenseScreenProps = NativeStackScreenProps<RootStackParamList, 'EditExpense'>;

/**
 * Props for CreateGroupScreen
 */
export type CreateGroupScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

/**
 * Props for SettlementScreen
 */
export type SettlementScreenProps = NativeStackScreenProps<RootStackParamList, 'Settlement'>;
