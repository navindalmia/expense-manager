import { SplitType } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { distributeAmountEvenly, distributeAmountByWeights, hasNonPositiveValue } from '../utils/splitCalculation';

/** Tolerance (in currency units / percentage points) for client-side rounding. */
const SPLIT_TOLERANCE = 0.01;

export interface SplitInput {
  splitType: SplitType;
  /** Total expense amount the split must account for. */
  amount: number;
  /** Number of members in the split (must be > 0). */
  memberCount: number;
  /** Explicit per-member amounts; only read for AMOUNT splits. */
  splitAmount: number[];
  /** Explicit per-member percentages; only read for PERCENTAGE splits. */
  splitPercentage: number[];
}

export interface ResolvedSplit {
  /** Per-member amounts to persist. */
  amounts: number[];
  /** Per-member percentages to persist; set only for PERCENTAGE splits. */
  percentages?: number[];
}

/**
 * Single definition of split validation + calculation, shared by
 * createExpense and updateExpense. Throws AppError 400 (EXPENSE_SPLIT_INVALID /
 * EXPENSE_PERCENT_INVALID) for non-positive entries or sums that do not match.
 */
export function resolveSplit(input: SplitInput): ResolvedSplit {
  const { splitType, amount, memberCount, splitAmount, splitPercentage } = input;

  switch (splitType) {
    case SplitType.EQUAL:
      // Payer is optional in the split - divide by the actual member count only
      return { amounts: distributeAmountEvenly(amount, memberCount) };

    case SplitType.AMOUNT: {
      if (hasNonPositiveValue(splitAmount)) {
        throw new AppError('EXPENSE.SPLIT_AMOUNT_INVALID', 400, 'EXPENSE_SPLIT_INVALID');
      }
      const sum = splitAmount.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - amount) > SPLIT_TOLERANCE) {
        throw new AppError('EXPENSE.SPLIT_SUM_MISMATCH', 400, 'EXPENSE_SPLIT_INVALID');
      }
      return { amounts: splitAmount };
    }

    case SplitType.PERCENTAGE: {
      if (hasNonPositiveValue(splitPercentage)) {
        throw new AppError('EXPENSE.SPLIT_PERCENTAGE_INVALID', 400, 'EXPENSE_PERCENT_INVALID');
      }
      const sum = splitPercentage.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > SPLIT_TOLERANCE) {
        throw new AppError('EXPENSE.SPLIT_PERCENTAGE_INVALID', 400, 'EXPENSE_PERCENT_INVALID');
      }
      return { amounts: distributeAmountByWeights(amount, splitPercentage), percentages: splitPercentage };
    }
  }
}
