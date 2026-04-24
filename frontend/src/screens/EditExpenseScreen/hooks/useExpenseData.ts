/**
 * useExpenseData Hook
 * Fetches expense, categories, and group members in parallel
 * GUARANTEES: If loading=false, all three data sources are populated
 * Fixes Issue #1: Uses Promise.all() to load all 3 sources atomically
 */

import { useState, useEffect } from 'react';
import { getExpenseById, type Expense } from '../../../services/expenseService';
import { getCategories, type Category } from '../../../services/categoryService';
import { getGroup } from '../../../services/groupService';
import { getErrorMessage } from '../../../utils/errorHandler';
import { logger } from '../../../utils/logger';

export interface GroupMember {
  id: number;
  name: string;
  email: string;
}

interface UseExpenseDataReturn {
  expense: Expense | null;
  categories: Category[];
  groupMembers: GroupMember[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetch expense data, categories, and group members in parallel
 * @param expenseId - ID of expense to fetch (optional - if null, skips expense fetch for CREATE mode)
 * @param groupId - ID of group to fetch members from
 * @returns Object with all fetched data + loading/error states
 * 
 * GUARANTEE: If loading=false, then categories/groupMembers are populated
 * expense will be null if expenseId was not provided (CREATE mode)
 */
export function useExpenseData(expenseId: number | null | undefined, groupId: number): UseExpenseDataReturn {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        setError(null);

        // ✅ For CREATE mode: expenseId is null/undefined, skip expense fetch
        const expensePromise = expenseId ? getExpenseById(expenseId) : Promise.resolve(null);

        // ✅ Fetch all data sources IN PARALLEL
        const [fetchedExpense, fetchedCategories, group] = await Promise.all([
          expensePromise,
          getCategories(),
          getGroup(groupId),
        ]);

        // ✅ ATOMIC UPDATE: Set all at once, then set loading=false
        // For CREATE mode: expense will be null
        setExpense(fetchedExpense);
        setCategories(fetchedCategories);
        setGroupMembers(group.members);
        setLoading(false);

        // DEBUG: Log paidBy details
        if (fetchedExpense) {
          console.log(`💳 EditExpenseScreen loaded expense "${fetchedExpense.title}" - paidById: ${fetchedExpense.paidById}, paidBy.id: ${fetchedExpense.paidBy?.id}, paidBy.name: ${fetchedExpense.paidBy?.name}`);
        }

        logger.info('Expense data loaded successfully', {
          screen: 'EditExpenseScreen',
          expenseId,
          groupId,
          categoryCount: fetchedCategories.length,
          memberCount: group.members.length,
        });
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(errorMessage);
        setLoading(false);

        logger.error('Failed to load expense data', err, {
          screen: 'EditExpenseScreen',
          action: 'useExpenseData',
          expenseId,
          groupId,
        });
      }
    };

    fetchAllData();
  }, [expenseId, groupId]);

  return { expense, categories, groupMembers, loading, error };
}
