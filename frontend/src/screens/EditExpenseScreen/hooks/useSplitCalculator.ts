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
  paidById: number | null
): UseSplitCalculatorReturn {
  const [splitState, setSplitState] = useState<SplitState>({
    splitType: 'EQUAL',
    splitWithIds: [],
    splitAmount: {},
    splitPercentage: {},
  });

  // ✅ Issue #5: Auto-recalculate EQUAL split when amount or members change
  useEffect(() => {
    if (
      splitState.splitType === 'EQUAL' &&
      splitState.splitWithIds.length > 0 &&
      paidById !== null
    ) {
      const totalMembers = splitState.splitWithIds.length + 1; // +1 for payer
      const sharePercent = (100 / totalMembers).toFixed(2);

      const newPercentages: Record<number, string> = {
        [paidById]: sharePercent,
      };

      splitState.splitWithIds.forEach(memberId => {
        newPercentages[memberId] = sharePercent;
      });

      setSplitState(prev => ({
        ...prev,
        splitPercentage: newPercentages,
      }));
    }
  }, [splitState.splitType, splitState.splitWithIds.length, expenseAmount, paidById]);

  // Clear old payer from split amounts when paidById changes
  useEffect(() => {
    setSplitState(prev => {
      const newSplitAmount: Record<number, string> = {};
      const newSplitPercentage: Record<number, string> = {};
      
      // Keep only current payer and members
      Object.entries(prev.splitAmount).forEach(([id, val]) => {
        const memberId = parseInt(id);
        if (memberId === paidById || prev.splitWithIds.includes(memberId)) {
          newSplitAmount[memberId] = val;
        }
      });
      
      Object.entries(prev.splitPercentage).forEach(([id, val]) => {
        const memberId = parseInt(id);
        if (memberId === paidById || prev.splitWithIds.includes(memberId)) {
          newSplitPercentage[memberId] = val;
        }
      });
      
      return {
        ...prev,
        splitAmount: newSplitAmount,
        splitPercentage: newSplitPercentage,
      };
    });
  }, [paidById]);

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
    setSplitState(prev => ({
      ...prev,
      splitType: type,
    }));
  }, []);

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

      if (splitState.splitType === 'AMOUNT' && paidById !== null) {
        // Convert to array: [payer_amt, member1_amt, member2_amt, ...]
        const allIds = [paidById, ...splitState.splitWithIds];
        payload.splitAmount = allIds.map(
          id => parseFloat(splitState.splitAmount[id] || '0')
        );
      } else if (splitState.splitType === 'PERCENTAGE' && paidById !== null) {
        // Convert to array: [payer%, member1%, member2%, ...]
        const allIds = [paidById, ...splitState.splitWithIds];
        payload.splitPercentage = allIds.map(
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
