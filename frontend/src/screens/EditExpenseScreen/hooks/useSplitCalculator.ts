/**
 * useSplitCalculator Hook
 * Manages split configuration (EQUAL/AMOUNT/PERCENTAGE)
 * 
 * Fixes:
 * - Issue #2: Receives paidById so getSplitPayload() can construct correct arrays
 * - Issue #4: Uses shared validation logic (no duplication)
 * - Issue #5: Auto-recalculates EQUAL splits when amount/members change
 */

import { useState, useCallback, useEffect } from 'react';
import type { SplitType } from '../../../types/common';
import { validateSplitConfig, calculateSplitTotal } from '../utils/splitValidation';

export interface SplitState {
  splitType: SplitType;
  splitWithIds: number[];
  splitAmount: Record<number, string>;
  splitPercentage: Record<number, string>;
}

interface UseSplitCalculatorReturn {
  splitState: SplitState;
  addMember: (memberId: number) => void;
  removeMember: (memberId: number) => void;
  updateAmount: (memberId: number, amount: string) => void;
  updatePercentage: (memberId: number, percentage: string) => void;
  setSplitType: (type: SplitType) => void;
  validateSplit: () => boolean;
  getValidationError: () => string | null;
  getSplitPayload: () => { splitType?: SplitType; splitWithIds: number[]; splitAmount?: number[]; splitPercentage?: number[] };
}

/**
 * Manage split configuration with validation and payload construction
 * 
 * Behavior:
 * - EQUAL: Member percentages auto-recalculate when amount or member count changes
 * - AMOUNT: Member amounts do NOT auto-recalculate (user must update manually)
 * - PERCENTAGE: Member percentages do NOT auto-recalculate (user must update manually)
 * 
 * @param expenseAmount - Total expense amount (used for AMOUNT split validation and EQUAL recalc)
 * @param paidById - ID of user who paid (required for PERCENTAGE payload construction)
 * @returns Split state management functions
 */
export function useSplitCalculator(
  expenseAmount: string,
  paidById: number | null,
  groupMembers: Array<{ id: number; name: string }> = [],
  savedExpense?: any
): UseSplitCalculatorReturn {
  const [splitState, setSplitState] = useState<SplitState>(() => {
    // Initialize with all members selected by default
    const initialMembers = groupMembers.filter(m => m.id !== paidById).map(m => m.id);
    return {
      splitType: 'EQUAL',
      splitWithIds: initialMembers,
      splitAmount: {},
      splitPercentage: {},
    };
  });

  // ✅ Issue #5: Auto-recalculate EQUAL split when amount or members change
  useEffect(() => {
    if (
      splitState.splitType === 'EQUAL' &&
      splitState.splitWithIds.length > 0 &&
      paidById !== null
    ) {
      // Payer is now optional - only divide by actual split members
      const totalMembers = splitState.splitWithIds.length;
      const sharePercent = (100 / totalMembers).toFixed(2);

      const newPercentages: Record<number, string> = {};
      splitState.splitWithIds.forEach(memberId => {
        newPercentages[memberId] = sharePercent;
      });

      setSplitState(prev => ({
        ...prev,
        splitPercentage: newPercentages,
      }));
    }
  }, [splitState.splitType, splitState.splitWithIds.length, expenseAmount, paidById]);

  // Reinitialize split with all members ONLY on first load when no saved split exists
  useEffect(() => {
    setSplitState(prev => {
      // If loading a saved expense with splitWith, don't reinitialize - let EditExpenseScreen populate it
      if (savedExpense?.splitWith && savedExpense.splitWith.length > 0) {
        return prev;
      }

      // If splitWithIds is already set (from loading saved expense), don't override
      if (prev.splitWithIds.length > 0) {
        return prev;
      }

      // Only reinitialize if starting fresh (no saved split)
      const newMembers = groupMembers.filter(m => m.id !== paidById).map(m => m.id);
      
      const newSplitAmount: Record<number, string> = {};
      const newSplitPercentage: Record<number, string> = {};
      
      // Keep amounts/percentages for still-valid members
      Object.entries(prev.splitAmount).forEach(([id, val]) => {
        const memberId = parseInt(id);
        if (newMembers.includes(memberId)) {
          newSplitAmount[memberId] = val;
        }
      });
      
      Object.entries(prev.splitPercentage).forEach(([id, val]) => {
        const memberId = parseInt(id);
        if (newMembers.includes(memberId)) {
          newSplitPercentage[memberId] = val;
        }
      });
      
      return {
        ...prev,
        splitWithIds: newMembers,
        splitAmount: newSplitAmount,
        splitPercentage: newSplitPercentage,
      };
    });
  }, [paidById, groupMembers.length, savedExpense?.splitWith?.length]);

  const addMember = useCallback((memberId: number) => {
    setSplitState(prev => {
      // Prevent duplicate members
      if (prev.splitWithIds.includes(memberId)) {
        return prev;
      }
      return {
        ...prev,
        splitWithIds: [...prev.splitWithIds, memberId],
      };
    });
  }, []);

  const removeMember = useCallback((memberId: number) => {
    setSplitState(prev => ({
      ...prev,
      splitWithIds: prev.splitWithIds.filter(id => id !== memberId),
      splitAmount: Object.fromEntries(
        Object.entries(prev.splitAmount).filter(([id]) => parseInt(id) !== memberId)
      ),
      splitPercentage: Object.fromEntries(
        Object.entries(prev.splitPercentage).filter(([id]) => parseInt(id) !== memberId)
      ),
    }));
  }, []);

  const updateAmount = useCallback((memberId: number, amount: string) => {
    setSplitState(prev => ({
      ...prev,
      splitAmount: {
        ...prev.splitAmount,
        [memberId]: amount,
      },
    }));
  }, []);

  const updatePercentage = useCallback((memberId: number, percentage: string) => {
    setSplitState(prev => ({
      ...prev,
      splitPercentage: {
        ...prev.splitPercentage,
        [memberId]: percentage,
      },
    }));
  }, []);

  const setSplitTypeCallback = useCallback((type: SplitType) => {
    setSplitState(prev => {
      const newState: SplitState = {
        ...prev,
        splitType: type,
      };

      // Auto-populate defaults when switching split types
      if (type === 'PERCENTAGE' && prev.splitWithIds.length > 0) {
        // Default: equal percentage per member
        const defaultPercent = (100 / prev.splitWithIds.length).toFixed(2);
        const newPercentages: Record<number, string> = {};
        prev.splitWithIds.forEach(memberId => {
          newPercentages[memberId] = defaultPercent;
        });
        newState.splitPercentage = newPercentages;
        newState.splitAmount = {}; // Clear amounts
      } else if (type === 'AMOUNT' && prev.splitWithIds.length > 0) {
        // Default: divide expenseAmount equally among members
        const memberAmount = (parseFloat(expenseAmount) / prev.splitWithIds.length).toFixed(2);
        const newAmounts: Record<number, string> = {};
        prev.splitWithIds.forEach(memberId => {
          newAmounts[memberId] = memberAmount;
        });
        newState.splitAmount = newAmounts;
        newState.splitPercentage = {}; // Clear percentages
      } else if (type === 'EQUAL') {
        // Clear both - auto-calculated
        newState.splitAmount = {};
        newState.splitPercentage = {};
      }

      // Clean up stale entries: only keep values for members still in split
      if (newState.splitAmount && Object.keys(newState.splitAmount).length > 0) {
        newState.splitAmount = Object.fromEntries(
          Object.entries(newState.splitAmount).filter(([id]) =>
            prev.splitWithIds.includes(parseInt(id))
          )
        );
      }
      if (newState.splitPercentage && Object.keys(newState.splitPercentage).length > 0) {
        newState.splitPercentage = Object.fromEntries(
          Object.entries(newState.splitPercentage).filter(([id]) =>
            prev.splitWithIds.includes(parseInt(id))
          )
        );
      }

      return newState;
    });
  }, [expenseAmount]);

  // ✅ Issue #4: Use shared validation (no duplication)
  const getValidationError = useCallback((): string | null => {
    if (splitState.splitWithIds.length === 0) {
      return null; // No split = valid
    }
    return validateSplitConfig(
      splitState.splitType,
      expenseAmount,
      splitState.splitAmount,
      splitState.splitPercentage
    );
  }, [splitState.splitType, expenseAmount, splitState.splitAmount, splitState.splitPercentage, splitState.splitWithIds.length]);

  const validateSplit = useCallback((): boolean => {
    return getValidationError() === null;
  }, [getValidationError]);

  // ✅ Issue #2: Construct payload with paidById baked in
  const getSplitPayload = useCallback(
    () => {
      if (splitState.splitWithIds.length === 0) {
        return { splitWithIds: [] };
      }

      // Validate before constructing payload
      const error = getValidationError();
      if (error) {
        throw new Error(error);
      }

      const payload: any = {
        splitType: splitState.splitType,
        splitWithIds: splitState.splitWithIds,
      };

      if (splitState.splitType === 'AMOUNT' && splitState.splitWithIds.length > 0) {
        // Convert to array of amounts only for members in split (payer is NOT included)
        payload.splitAmount = splitState.splitWithIds.map(
          id => parseFloat(splitState.splitAmount[id] || '0')
        );
      } else if (splitState.splitType === 'PERCENTAGE' && splitState.splitWithIds.length > 0) {
        // Convert to array of percentages only for members in split (payer is NOT included)
        payload.splitPercentage = splitState.splitWithIds.map(
          id => parseFloat(splitState.splitPercentage[id] || '0')
        );
      }

      return payload;
    },
    [splitState, paidById, getValidationError]
  );

  return {
    splitState,
    addMember,
    removeMember,
    updateAmount,
    updatePercentage,
    setSplitType: setSplitTypeCallback,
    validateSplit,
    getValidationError,
    getSplitPayload,
  };
}
