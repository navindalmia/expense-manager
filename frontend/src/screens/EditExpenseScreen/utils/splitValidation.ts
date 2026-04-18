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
 * Calculate a single member's share based on split type
 * DRY helper to prevent duplication between display and backend calculations
 * 
 * @param splitType - Type of split (EQUAL, AMOUNT, PERCENTAGE)
 * @param totalAmount - Total expense amount
 * @param memberAmount - Member's amount (for AMOUNT split)
 * @param memberPercentage - Member's percentage (for PERCENTAGE split)
 * @param totalMembers - Total number of people in split (including payer)
 * @returns Calculated share as string with 2 decimals
 */
export function calculateMemberShare(
  splitType: SplitType,
  totalAmount: number,
  memberAmount: string | number = '0',
  memberPercentage: string | number = '0',
  totalMembers: number = 1
): string {
  const amount = parseFloat(String(totalAmount || '0'));
  
  if (splitType === 'EQUAL') {
    return (amount / totalMembers).toFixed(2);
  } else if (splitType === 'AMOUNT') {
    return parseFloat(String(memberAmount || '0')).toFixed(2);
  } else if (splitType === 'PERCENTAGE') {
    const pct = parseFloat(String(memberPercentage || '0'));
    return (amount * pct / 100).toFixed(2);
  }
  
  return '0.00';
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
    const target = parseFloat(expenseAmount);
    if (isNaN(target) || target <= 0) {
      return 'Expense amount must be greater than 0';
    }
    
    // Check for negative amounts
    for (const amount of Object.values(splitAmount)) {
      const val = parseFloat(amount || '0');
      if (val < 0) {
        return 'Split amounts cannot be negative';
      }
    }
    
    const total = calculateSplitTotal(splitType, splitAmount, splitPercentage);
    // Increased tolerance from 0.01 to 0.05 to account for rounding in auto-calculations
    if (Math.abs(total - target) > 0.05) {
      return `Split amounts must sum to ${expenseAmount} (currently ${total.toFixed(2)})`;
    }
  } else if (splitType === 'PERCENTAGE') {
    // Check for negative percentages
    for (const pct of Object.values(splitPercentage)) {
      const val = parseFloat(pct || '0');
      if (val < 0) {
        return 'Split percentages cannot be negative';
      }
    }
    
    const total = calculateSplitTotal(splitType, splitAmount, splitPercentage);
    // Increased tolerance from 0.01 to 0.05 to account for rounding in auto-calculations
    if (Math.abs(total - 100) > 0.05) {
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
