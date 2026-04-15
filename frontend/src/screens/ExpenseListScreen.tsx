/**
 * Expense List Screen
 * 
 * Displays list of user expenses with loading and error states.
 * Fetches expenses from backend on mount.
 * Provides navigation to create and manage expenses.
 */

import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getGroupExpenses } from '../services/expenseService';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { useAuth } from '../context/AuthContext';
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
  const params = route.params || {};
  const groupId = params.groupId || 0;
  const groupName = params.groupName || 'Group';
  const { user: currentUser } = useAuth();
  
  // DEBUG: Log what we actually received
  if (__DEV__) {
    console.log('📍 ExpenseListScreen mounted', {
      params: JSON.stringify(params),
      groupId,
      groupName,
    });
  }
  
  // Validate required params - warn if missing
  if (!groupId || groupId === 0) {
    if (__DEV__) {
      console.warn('⚠️ ExpenseListScreen: Missing or invalid groupId', {
        groupId,
        params,
      });
    }
    logger.warn('ExpenseListScreen: Missing required groupId parameter', {
      screen: 'ExpenseListScreen',
      groupId,
    });
  }
  
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
   * Wrapped in useCallback to prevent infinite render loops
   * when included in useEffect dependency array.
   */
  const loadExpenses = useCallback(async () => {
    try {
      if (__DEV__) {
        console.log('🔄 loadExpenses called with groupId:', groupId);
      }
      
      setError(null);
      const data = await getGroupExpenses(groupId);
      
      if (__DEV__) {
        console.log('✅ Expenses loaded:', {
          count: data.length,
          groupId,
          data: data.map(e => ({ id: e.id, title: e.title, amount: e.amount }))
        });
      }
      
      setExpenses(data);
      
      // Update currency preference from first expense
      if (data.length > 0) {
        setCurrencyPreference(data[0].currency.code);
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      
      if (__DEV__) {
        console.error('❌ Failed to load expenses:', {
          error: errorMessage,
          groupId,
          rawError: err,
        });
      }
      
      setError(errorMessage);
      logger.error('Failed to load expenses', err, {
        screen: 'ExpenseListScreen',
        action: 'loadExpenses',
        groupId,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  /**
   * Load expenses on component mount or when groupId changes.
   * CRITICAL: groupId in dependency array ensures expenses reload
   * when user navigates to different group.
   */
  useEffect(() => {
    loadExpenses();
  }, [groupId, loadExpenses]); // ✓ Include groupId to reload on change

  /**
   * Track if this is the first focus event (on mount).
   * useFocusEffect runs on mount, but we want initial load from useEffect only.
   * On subsequent navigation back, useFocusEffect refreshes the list.
   */
  const isInitialRenderRef = useRef(true);

  /**
   * Refresh expenses when screen is focused (e.g., returning from CreateExpenseScreen).
   * Skip the first render to avoid double-loading (useEffect handles first load).
   * This ensures the list always shows the latest expenses when user navigates back.
   */
  useFocusEffect(
    useCallback(() => {
      // Skip first render - let useEffect handle initial load
      if (isInitialRenderRef.current) {
        isInitialRenderRef.current = false;
        return;
      }
      
      if (__DEV__) {
        console.log('🔄 ExpenseListScreen focused - reloading expenses for groupId:', groupId);
      }
      loadExpenses();
    }, [loadExpenses, groupId])
  );

  /**
   * Handle pull-to-refresh gesture.
   */
  const handleRefresh = () => {
    if (__DEV__) {
      console.log('🔄 Pull-to-refresh triggered');
    }
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
          // Tap to edit expense
          navigation.navigate('EditExpense', { 
            expenseId: item.id,
            groupId,
            groupName,
            groupCurrencyCode: params.groupCurrencyCode,
          });
        }}
        testID={`expense-item-${item.id}`}
        accessible={true}
        accessibilityLabel={`${item.title}, ${item.currency.code} ${item.amount.toFixed(2)}`}
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
            {item.currency.code} {item.amount.toFixed(2)}
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
    [navigation, groupId, groupName, params.groupCurrencyCode]
  );

  /**
   * Calculate financial summary for header.
   * - Total: Sum of all expenses
   * - Personal: Sum of current user's split amounts (what they owe)
   */
  const calculateTotals = useCallback(() => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const personal = expenses.reduce((sum, exp) => {
      let userShare = 0;

      // Check if user is the payer
      if (exp.paidBy?.id === currentUser?.id) {
        // User is the payer - calculate their share based on split type
        if (exp.splitType === 'EQUAL' && exp.splitWith && exp.splitWith.length > 0) {
          // Equal split: amount ÷ (splitWith.length + 1) including payer
          userShare = exp.amount / (exp.splitWith.length + 1);
        } else if (exp.splitType === 'PERCENTAGE' && exp.splitPercentage) {
          // Percentage split: payer's % is at index 0
          userShare = (exp.amount * exp.splitPercentage[0]) / 100;
        } else if (exp.splitType === 'AMOUNT' && exp.splitAmount) {
          // Amount split: total - sum of others' amounts
          userShare = exp.amount - exp.splitAmount.reduce((a, b) => a + b, 0);
        } else if (!exp.splitWith || exp.splitWith.length === 0) {
          // No split - user pays full amount
          userShare = exp.amount;
        }
      } else {
        // User is in splitWith - find their share
        const userIndex = exp.splitWith?.findIndex(u => u.id === currentUser?.id) ?? -1;
        if (userIndex !== -1) {
          if (exp.splitType === 'EQUAL') {
            userShare = exp.amount / (exp.splitWith!.length + 1);
          } else if (exp.splitType === 'PERCENTAGE' && exp.splitPercentage?.[userIndex + 1]) {
            // Members' percentages start at index 1
            userShare = (exp.amount * exp.splitPercentage[userIndex + 1]) / 100;
          } else if (exp.splitType === 'AMOUNT' && exp.splitAmount?.[userIndex]) {
            userShare = exp.splitAmount[userIndex];
          }
        }
      }

      return sum + userShare;
    }, 0);
    
    return { total, personal };
  }, [expenses, currentUser?.id]);

  const { total, personal } = calculateTotals();

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
          onPress={() => navigation.navigate('CreateExpense', { groupId, groupName, groupCurrencyCode: params.groupCurrencyCode })}
          testID="empty-state-add-button"
          accessible={true}
          accessibilityLabel="Add your first expense"
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>Add First Expense</Text>
        </TouchableOpacity>
      </View>
    ),
    [navigation, groupId, groupName]
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
        <View style={styles.headerContent}>
          <Text 
            style={styles.headerTitle}
            testID="header-title"
          >
            {groupName || 'Expenses'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            navigation.navigate('CreateExpense', { groupId, groupName, groupCurrencyCode: params.groupCurrencyCode });
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
          accessibilityLabel={`Total: ${currencyPreference} ${total.toFixed(2)}, Your share: ${currencyPreference} ${personal.toFixed(2)}`}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <View>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryAmount}>
                {currencyPreference} {total.toFixed(2)}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>My Personal</Text>
              <Text style={styles.summaryAmount}>
                {currencyPreference} {personal.toFixed(2)}
              </Text>
            </View>
          </View>
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
