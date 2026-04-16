/**
 * Split Validation Utilities
 * Shared validation logic for split calculations (EQUAL/AMOUNT/PERCENTAGE)
 * Prevents duplication between validateSplit() and getSplitPayload()
 */

import type { SplitType } from '../../../types/common';

/**
 * Calculate total split (sum of amounts or percentages)
 * @param splitType - Type of split (EQUAL, AMOUNT, PERCENTAGE)
 * @param splitAmount - Map of member ID to amount
 * @param splitPercentage - Map of member ID to percentage
 * @returns Total amount or percentage
 */
export function calculateSplitTotal(
  splitType: SplitType,
  splitAmount: Record<number, string>,
  splitPercentage: Record<number, string>
): number {
  if (splitType === 'AMOUNT') {
    return Object.values(splitAmount).reduce((sum, val) => sum + parseFloat(val || '0'), 0);
  } else if (splitType === 'PERCENTAGE') {
    return Object.values(splitPercentage).reduce((sum, val) => sum + parseFloat(val || '0'), 0);
  }
  return 0;
}

/**
 * Validate split configuration
 * @param splitType - Type of split
 * @param expenseAmount - Total expense amount
 * @param splitAmount - Map of member amounts
 * @param splitPercentage - Map of member percentages
 * @returns Validation error message or null if valid
 */
export function validateSplitConfig(
  splitType: SplitType,
  expenseAmount: string,
  splitAmount: Record<number, string>,
  splitPercentage: Record<number, string>
): string | null {
  if (splitType === 'AMOUNT') {
    const total = calculateSplitTotal(splitType, splitAmount, splitPercentage);
    const target = parseFloat(expenseAmount);
    if (isNaN(target) || target <= 0) {
      return 'Expense amount must be greater than 0';
    }
    if (Math.abs(total - target) > 0.01) {
      return `Split amounts must sum to ${expenseAmount} (currently ${total.toFixed(2)})`;
    }
  } else if (splitType === 'PERCENTAGE') {
    const total = calculateSplitTotal(splitType, splitAmount, splitPercentage);
    if (Math.abs(total - 100) > 0.01) {
      return `Split percentages must sum to 100% (currently ${total.toFixed(2)}%)`;
    }
  }
  return null;
}

/**
 * Check if split configuration is valid
 * @param splitType - Type of split
 * @param expenseAmount - Total expense amount
 * @param splitAmount - Map of member amounts
 * @param splitPercentage - Map of member percentages
 * @returns true if valid, false otherwise
 */
export function isSplitValid(
  splitType: SplitType,
  expenseAmount: string,
  splitAmount: Record<number, string>,
  splitPercentage: Record<number, string>
): boolean {
  return validateSplitConfig(splitType, expenseAmount, splitAmount, splitPercentage) === null;
}
