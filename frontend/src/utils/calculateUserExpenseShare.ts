/**
 * Calculate a user's share of an expense based on split type and their
 * role (payer vs. split member).
 *
 * Single source of truth -- extracted (issue #46, 2026-09) from what were
 * three independent, drifting copies of this exact logic:
 * ExpenseListScreen.tsx's calculateUserShare, SettlementScreen.tsx's
 * calculateUserExpenseShare (whose own docstring incorrectly claimed it
 * was already shared), and the backend's own copy in groupService.ts
 * (necessarily separate -- different runtime/package, this repo is two
 * independent workspaces, not a shared-package monorepo).
 *
 * Both frontend screens now import this instead of keeping their own
 * copy. See docs/solutions/logic-errors/ for the specific bug this
 * duplication let slip through (the same wrong PERCENTAGE fallback fixed
 * independently in groupService.ts and here).
 */

import type { Expense } from '../services/expenseService';

export function calculateUserExpenseShare(exp: Expense, userId: number | undefined): number {
  if (!userId) return 0;

  // Check if user is the payer
  if (exp.paidBy?.id === userId) {
    // User is the payer - calculate their share based on split type
    if (exp.splitType === 'EQUAL' && exp.splitWith && exp.splitWith.length > 0) {
      // Backend divides amount / splitWith.length exactly among whoever is
      // in splitWith. If the payer opted out of the split (unticked), their
      // share is 0 - the others' shares already sum to the full amount.
      const payerInSplit = exp.splitWith.some((m) => m.id === exp.paidBy?.id);
      return payerInSplit ? exp.amount / exp.splitWith.length : 0;
    } else if (exp.splitType === 'PERCENTAGE' && exp.splitPercentage) {
      // Find payer's index in splitWith
      const payerIndex = exp.splitWith?.findIndex((m) => m.id === exp.paidBy?.id) ?? -1;
      if (payerIndex !== -1 && exp.splitPercentage?.[payerIndex]) {
        return (exp.amount * exp.splitPercentage[payerIndex]) / 100;
      }
      // Payer opted out of the percentage split entirely (not in
      // splitWith) -- their own share is 0, same as the EQUAL branch
      // above. Bug fixed here (issue #46): this used to fall back to
      // exp.splitPercentage[0], which is splitWith[0]'s percentage, not
      // the payer's -- attributing another member's share to the payer.
    } else if (exp.splitType === 'AMOUNT' && exp.splitAmount) {
      // Amount split: total - sum of others' amounts
      return exp.amount - exp.splitAmount.reduce((a, b) => a + b, 0);
    } else if (!exp.splitWith || exp.splitWith.length === 0) {
      // No split - user pays full amount
      return exp.amount;
    }
  } else {
    // User is in splitWith - find their share
    const userIndex = exp.splitWith?.findIndex((u) => u.id === userId) ?? -1;
    if (userIndex !== -1) {
      if (exp.splitType === 'EQUAL') {
        return exp.amount / exp.splitWith.length;
      } else if (exp.splitType === 'PERCENTAGE' && exp.splitPercentage?.[userIndex]) {
        return (exp.amount * exp.splitPercentage[userIndex]) / 100;
      } else if (exp.splitType === 'AMOUNT' && exp.splitAmount?.[userIndex]) {
        return exp.splitAmount[userIndex];
      }
    }
  }
  return 0;
}
