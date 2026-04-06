/**
 * Expense List Screen
 * 
 * Displays list of user expenses with loading and error states.
 * Fetches expenses from backend on mount.
 * Provides navigation to create and manage expenses.
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { getGroupExpenses } from '../services/expenseService';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { styles } from './ExpenseListScreen.styles';
import type { Expense } from '../services/expenseService';
import type { ExpenseListScreenProps } from '../types/navigation';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';



/**
 * Main screen component displaying list of expenses for a group.
 * Wrapped in memo() to prevent unnecessary re-renders.
 * 
 * Features:
 * - Fetch expenses for specific group from backend
 * - Display in scrollable list with memoized renderers
 * - Pull-to-refresh for reloading
 * - Loading spinner during fetch
 * - Error message with retry option
 * - Empty state when no expenses
 * - Proper accessibility labels for screen readers
 */
function ExpenseListScreen({ navigation, route }: ExpenseListScreenProps) {
  const { groupId } = route.params;
  
  // State management
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store primary currency from first expense or default
  const [currencyPreference, setCurrencyPreference] = useState<string>('GBP');

  /**
   * Fetch expenses from backend.
   * Sets loading state and handles errors.
   * Uses logger for centralized error tracking.
   * Fetches only expenses for this group (no orphan expenses).
   */
  const loadExpenses = async () => {
    try {
      setError(null);
      const data = await getGroupExpenses(groupId); // ← Use groupId-scoped endpoint
      setExpenses(data);
      
      // Update currency preference from first expense
      if (data.length > 0) {
        setCurrencyPreference(data[0].currency);
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      
      // Use logger instead of console.error for centralized tracking
      logger.error('Failed to load expenses', err, {
        screen: 'ExpenseListScreen',
        action: 'loadExpenses',
        groupId,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Load expenses on component mount or when groupId changes.
   * CRITICAL: groupId in dependency array ensures expenses reload
   * when user navigates to different group.
   */
  useEffect(() => {
    loadExpenses();
  }, [groupId, loadExpenses]); // ✓ Include groupId to reload on change

  /**
   * Handle pull-to-refresh gesture.
   */
  const handleRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  /**
   * Render individual expense list item.
   * Wrapped in useCallback to prevent recreation on every render.
   * Only recreated if navigation dependency changes.
   */
  const renderExpenseItem = useCallback(
    ({ item }: { item: Expense }) => (
      <TouchableOpacity
        style={styles.expenseItem}
        onPress={() => {
          // Proper navigation using typed navigation prop
          navigation.navigate('ExpenseDetail', { expenseId: item.id });
        }}
        testID={`expense-item-${item.id}`}
        accessible={true}
        accessibilityLabel={`${item.title}, ${item.currency} ${item.amount.toFixed(2)}`}
        accessibilityRole="button"
      >
        <View style={styles.expenseHeader}>
          <Text 
            style={styles.expenseTitle}
            numberOfLines={1}
            testID={`expense-title-${item.id}`}
          >
            {item.title}
          </Text>
          <Text 
            style={styles.expenseAmount}
            testID={`expense-amount-${item.id}`}
          >
            {item.currency} {item.amount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.expenseFooter}>
          <Text 
            style={styles.expenseDate}
            testID={`expense-date-${item.id}`}
          >
            {new Date(item.expenseDate).toLocaleDateString()}
          </Text>
          <Text 
            style={styles.expenseCategory}
            testID={`expense-category-${item.id}`}
          >
            {item.category?.label || 'N/A'}
          </Text>
        </View>

        {item.notes && (
          <Text 
            style={styles.expenseNotes}
            testID={`expense-notes-${item.id}`}
          >
            {item.notes}
          </Text>
        )}
      </TouchableOpacity>
    ),
    [navigation]
  );

  /**
   * Render empty state.
   * Wrapped in useCallback to prevent recreation on every render.
   * Includes button to add first expense.
   */
  const renderEmptyState = useCallback(
    () => (
      <View 
        style={styles.emptyContainer}
        testID="empty-state"
        accessible={true}
        accessibilityLabel="No expenses. Add your first expense to get started"
      >
        <Text style={styles.emptyText}>No expenses yet</Text>
        <Text style={styles.emptySubtext}>Add your first expense to get started</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateExpense', { groupId })}
          testID="empty-state-add-button"
          accessible={true}
          accessibilityLabel="Add your first expense"
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>Add First Expense</Text>
        </TouchableOpacity>
      </View>
    ),
    [navigation]
  );

  /**
   * Render loading state.
   */
  if (loading) {
    return <LoadingState />;
  }

  /**
   * Render error state with retry option.
   */
  if (error) {
    return <ErrorState error={error} onRetry={handleRefresh} />;
  }

  /**
   * Render expense list.
   */
  return (
    <View 
      style={styles.container}
      testID="expense-list-screen"
    >
      <View style={styles.header}>
        <Text 
          style={styles.headerTitle}
          testID="header-title"
        >
          Expenses
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            navigation.navigate('CreateExpense', { groupId });
          }}
          testID="add-expense-button"
          accessible={true}
          accessibilityLabel="Add new expense"
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {expenses.length > 0 && (
        <View 
          style={styles.summaryCard}
          testID="summary-card"
          accessible={true}
          accessibilityLabel={`Total expenses: ${currencyPreference} ${expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}`}
        >
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryAmount}>
            {currencyPreference}{' '}
            {expenses
              .reduce((sum, exp) => sum + exp.amount, 0)
              .toFixed(2)}
          </Text>
        </View>
      )}

      <FlatList
        data={expenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#0066cc']}
            tintColor="#0066cc"
            title="Pull to refresh"
          />
        }
        contentContainerStyle={styles.listContent}
        testID="expenses-flat-list"
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />
    </View>
  );
}

// Memoize component to prevent unnecessary re-renders
export default memo(ExpenseListScreen);
