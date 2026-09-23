/**
 * Regression pack: issue #46. A payer who excludes themselves from a
 * PERCENTAGE split must get a 0 share, not the first split member's share.
 */
import { describe, it, expect } from 'vitest';
import { calculateUserExpenseShare } from '../../utils/calculateUserExpenseShare';
import type { Expense } from '../../services/expenseService';

describe('regression #46: payer excluded from PERCENTAGE split', () => {
  it('should give the payer 0 when the guest holds 100%', () => {
    const exp = {
      id: 1,
      amount: 100,
      paidBy: { id: 1, name: 'Host', email: 'host@test.com' },
      splitType: 'PERCENTAGE',
      splitWith: [{ id: 2, name: 'Guest', email: 'guest@test.com' }],
      splitAmount: [100],
      splitPercentage: [100],
    } as unknown as Expense;
    expect(calculateUserExpenseShare(exp, 1)).toBe(0);
    expect(calculateUserExpenseShare(exp, 2)).toBe(100);
  });
});
