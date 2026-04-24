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
import { calculateMemberShare } from './EditExpenseScreen/utils/splitValidation';
import { useAuth } from '../context/AuthContext';
import { styles } from './ExpenseListScreen.styles';
import { SummaryCard } from './ExpenseListScreen/SummaryCard';
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
   * Calculate user's share of an expense based on split type and their role.
   * Single source of truth - used by both renderExpenseItem and calculateTotals.
   * Handles payer inclusion detection for accurate calculations.
   * EXPORTED for reuse in SettlementScreen.
   */
  const calculateUserShare = useCallback((exp: Expense): number => {
    if (!exp.splitWith || exp.splitWith.length === 0) {
      // No split configured, user owes nothing
      return 0;
    }

    // Check if user is in the splitWith array
    const userInSplit = exp.splitWith.find(m => m.id === currentUser?.id);
    if (!userInSplit) {
      // User is not in the split, so they owe nothing
      return 0;
    }

    const userIndex = exp.splitWith.findIndex(m => m.id === currentUser?.id);

    if (exp.splitType === 'EQUAL') {
      return parseFloat(
        calculateMemberShare('EQUAL', exp.amount, '0', '0', exp.splitWith.length)
      );
    } else if (exp.splitType === 'PERCENTAGE' && exp.splitPercentage?.[userIndex]) {
      return parseFloat(
        calculateMemberShare('PERCENTAGE', exp.amount, '0', exp.splitPercentage[userIndex], 1)
      );
    } else if (exp.splitType === 'AMOUNT' && exp.splitAmount?.[userIndex]) {
      return exp.splitAmount[userIndex];
    }

    return 0;
  }, [currentUser?.id]);

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
      
      // Sort by expenseDate (descending = newest first), then by id (descending for deterministic order)
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.expenseDate).getTime();
        const dateB = new Date(b.expenseDate).getTime();
        if (dateB !== dateA) return dateB - dateA; // Most recent first
        return b.id - a.id; // Tie-breaker: newer id first
      });
      
      setExpenses(sorted);
      
      // Update currency preference from first expense
      if (sorted.length > 0) {
        setCurrencyPreference(sorted[0].currency?.code || 'USD');
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
   * Calculates and displays:
   * 1. Your spend this expense
   * 2. You owe/are owed on this expense
   * 3. Your total spend till now (cumulative from oldest)
   * 4. You owe/are owed till now (cumulative from oldest)
   * 5. Your share
   */
  const renderExpenseItem = useCallback(
    ({ item, index }: { item: Expense; index: number }) => {
      // Get currency code with fallback
      const currencyCode = item.currency?.code || 'USD';
      
      // DEBUG: Log paidBy details
      if (__DEV__) {
        console.log(`💳 Expense "${item.title}" - paidById: ${item.paidById}, paidBy.id: ${item.paidBy?.id}, paidBy.name: ${item.paidBy?.name}`);
      }
      
      // Calculate user's share for THIS expense
      const userShare = calculateUserShare(item);
      
      // Calculate what user paid for THIS expense (0 if they didn't pay it)
      const userPaidThisExpense = item.paidBy?.id === currentUser?.id ? item.amount : 0;
      
      // Balance on this expense: positive = owed to user, negative = user owes
      const balanceThisExpense = userPaidThisExpense - userShare;

      // Calculate cumulative (from oldest to this expense chronologically)
      // Sort expenses deterministically: by date (ascending), then by id (ascending)
      let cumulativeUserShare = 0;
      let cumulativeUserPaid = 0;

      const sortedExpenses = [...expenses].sort((a, b) => {
        const dateA = new Date(a.expenseDate).getTime();
        const dateB = new Date(b.expenseDate).getTime();
        if (dateA !== dateB) return dateA - dateB; // Older first
        return a.id - b.id; // Older ID first if same date
      });

      for (const exp of sortedExpenses) {
        // Stop after reaching current expense
        if (exp.id === item.id) {
          cumulativeUserShare += calculateUserShare(exp);
          if (exp.paidBy?.id === currentUser?.id) {
            cumulativeUserPaid += exp.amount;
          }
          break; // Inclusive - include current expense, then stop
        }
        
        cumulativeUserShare += calculateUserShare(exp);
        if (exp.paidBy?.id === currentUser?.id) {
          cumulativeUserPaid += exp.amount;
        }
      }

      // Cumulative balance: positive = owed to user, negative = user owes
      const cumulativeBalance = cumulativeUserPaid - cumulativeUserShare;

      return (
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
          accessibilityLabel={`${item.title}, ${currencyCode} ${item.amount.toFixed(2)}, your share: ${currencyCode} ${userShare.toFixed(2)}`}
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
              {currencyCode} {item.amount.toFixed(2)}
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

          {/* 5 Required Metrics Section - 2 Column Layout */}
          <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e0e0' }}>
            {/* Column Headers - Centered */}
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <View style={{ flex: 1, paddingRight: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#999', fontWeight: '600', textTransform: 'uppercase' }}>
                  This Expense
                </Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#999', fontWeight: '600', textTransform: 'uppercase' }}>
                  Total Till Now
                </Text>
              </View>
            </View>

            {/* Row 1: Your Spend */}
            <View style={{ flexDirection: 'row', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 6 }}>
              <View style={{ flex: 1, paddingRight: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#666', fontWeight: '500' }}>Spend:</Text>
                <Text style={{ fontSize: 12, color: '#666', fontWeight: '500' }}>{currencyCode} {userShare.toFixed(2)}</Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#666', fontWeight: '500' }}>Spend:</Text>
                <Text style={{ fontSize: 12, color: '#666', fontWeight: '500' }}>{currencyCode} {cumulativeUserShare.toFixed(2)}</Text>
              </View>
            </View>

            {/* Row 2: Owe/Owed Status */}
            <View style={{ flexDirection: 'row', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 6 }}>
              <View style={{ flex: 1, paddingRight: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#666', fontWeight: '500' }}>Status:</Text>
                <Text style={{ fontSize: 12, color: balanceThisExpense > 0 ? '#28a745' : balanceThisExpense < -0.01 ? '#dc3545' : '#999', fontWeight: '500' }}>
                  {balanceThisExpense > 0.01 ? `Owed ${currencyCode} ${balanceThisExpense.toFixed(2)}` : balanceThisExpense < -0.01 ? `Owe ${currencyCode} ${Math.abs(balanceThisExpense).toFixed(2)}` : `Even ${currencyCode} 0.00`}
                </Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#666', fontWeight: '500' }}>Status:</Text>
                <Text style={{ fontSize: 12, color: cumulativeBalance > 0 ? '#28a745' : cumulativeBalance < -0.01 ? '#dc3545' : '#999', fontWeight: '500' }}>
                  {cumulativeBalance > 0.01 ? `Owed ${currencyCode} ${cumulativeBalance.toFixed(2)}` : cumulativeBalance < -0.01 ? `Owe ${currencyCode} ${Math.abs(cumulativeBalance).toFixed(2)}` : `Even ${currencyCode} 0.00`}
                </Text>
              </View>
            </View>

            {/* Row 3: Paid by (left) vs Your Share (right) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, color: '#666', fontWeight: '500' }}>Paid by:</Text>
                <Text style={{ fontSize: 12, color: '#333', fontWeight: '600' }}>{item.paidBy?.name || 'Unknown'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, color: '#0066cc', fontWeight: '600' }}>Your share:</Text>
                <Text style={{ fontSize: 13, color: '#0066cc', fontWeight: '700' }}>{item.currency.code} {userShare.toFixed(2)}</Text>
              </View>
            </View>
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
      );
    },
    [navigation, groupId, groupName, params.groupCurrencyCode, expenses, currentUser?.id, calculateUserShare]
  );

  /**
   * Calculate financial summary for header.
   * - Total: Sum of all expenses
   * - Personal: Sum of current user's split amounts (what they owe)
   */
  const calculateTotals = useCallback(() => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Calculate what current user paid
    const userPaid = expenses
      .filter(exp => exp.paidBy?.id === currentUser?.id)
      .reduce((sum, exp) => sum + exp.amount, 0);
    
    // Use the same calculateUserShare function to avoid duplication
    const personal = expenses.reduce((sum, exp) => sum + calculateUserShare(exp), 0);
    
    // Balance: positive if user is owed, negative if user owes
    const balance = userPaid - personal;
    
    return { total, personal, balance };
  }, [expenses, currentUser?.id, calculateUserShare]);

  const { total, personal, balance } = calculateTotals();

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
          onPress={() => navigation.navigate('EditExpense', { groupId, groupName, groupCurrencyCode: params.groupCurrencyCode, currency: group?.currency })}
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
            navigation.navigate('EditExpense', { groupId, groupName, groupCurrencyCode: params.groupCurrencyCode });
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
        <SummaryCard
          total={total}
          personal={personal}
          balance={balance}
          currencyCode={currencyPreference}
          onPress={() => {
            console.log('📤 Navigating to Settlement with:', {
              groupId,
              groupName,
              expenseCount: expenses.length,
              expenseList: expenses.map(e => ({
                id: e.id,
                category: e.category,
                amount: e.amount,
                paidBy: e.paidBy?.name,
              })),
            });
            navigation.navigate('Settlement', { 
              groupId, 
              groupName,
              expenses 
            });
          }}
        />
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
