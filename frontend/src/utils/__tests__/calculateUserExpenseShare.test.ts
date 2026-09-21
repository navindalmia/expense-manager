/**
 * Tests for the shared calculateUserExpenseShare utility (issue #46).
 *
 * This was previously duplicated, untested, inline logic in
 * ExpenseListScreen.tsx and SettlementScreen.tsx -- this is the first
 * dedicated test coverage either copy has ever had.
 */

import { describe, it, expect } from 'vitest';
import { calculateUserExpenseShare } from '../calculateUserExpenseShare';
import type { Expense } from '../../services/expenseService';

const HOST_ID = 1;
const GUEST_ID = 2;
const OTHER_ID = 3;

function buildExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    title: 'Dinner',
    amount: 100,
    currency: { id: 1, code: 'GBP', label: 'British Pound' },
    paidById: HOST_ID,
    paidBy: { id: HOST_ID, name: 'Host', email: 'host@test.com' },
    categoryId: 1,
    category: { id: 1, code: 'FOOD', label: 'Food' },
    splitWith: [],
    splitAmount: [],
    splitPercentage: [],
    splitType: 'EQUAL',
    expenseDate: '2026-09-19T00:00:00.000Z',
    createdAt: '2026-09-19T00:00:00.000Z',
    settled: false,
    ...overrides,
  } as unknown as Expense;
}

describe('calculateUserExpenseShare', () => {
  it('returns 0 for an undefined userId', () => {
    expect(calculateUserExpenseShare(buildExpense(), undefined)).toBe(0);
  });

  describe('payer, EQUAL split', () => {
    it("gives the full per-person share when the payer is in their own split", () => {
      const exp = buildExpense({
        splitType: 'EQUAL',
        splitWith: [
          { id: HOST_ID, name: 'Host', email: 'host@test.com' },
          { id: GUEST_ID, name: 'Guest', email: 'guest@test.com' },
        ],
      });
      expect(calculateUserExpenseShare(exp, HOST_ID)).toBe(50);
    });

    it('gives the payer a 0 share when they opted out of the split', () => {
      const exp = buildExpense({
        splitType: 'EQUAL',
        splitWith: [
          { id: GUEST_ID, name: 'Guest', email: 'guest@test.com' },
          { id: OTHER_ID, name: 'Other', email: 'other@test.com' },
        ],
      });
      expect(calculateUserExpenseShare(exp, HOST_ID)).toBe(0);
    });
  });

  describe('payer, PERCENTAGE split (issue #46)', () => {
    it("gives the payer's own percentage-based share when they are in the split", () => {
      const exp = buildExpense({
        splitType: 'PERCENTAGE',
        splitWith: [
          { id: HOST_ID, name: 'Host', email: 'host@test.com' },
          { id: GUEST_ID, name: 'Guest', email: 'guest@test.com' },
        ],
        splitPercentage: [30, 70],
      });
      expect(calculateUserExpenseShare(exp, HOST_ID)).toBe(30);
    });

    it('gives the payer a 0 share when excluded from the split, not the first split member\'s percentage', () => {
      // Regression test: this exact scenario ("Dinner", host pays, host
      // excludes themselves, guest gets 100%) previously returned 100
      // (the guest's share) for the HOST instead of 0 -- confirmed live
      // against a real backend before the backend-side fix, see commit
      // 520893c and docs/plans/2026-09-19-issue-46-continuation.md.
      const exp = buildExpense({
        splitType: 'PERCENTAGE',
        splitWith: [{ id: GUEST_ID, name: 'Guest', email: 'guest@test.com' }],
        splitAmount: [100],
        splitPercentage: [100],
      });
      expect(calculateUserExpenseShare(exp, HOST_ID)).toBe(0);
    });
  });

  describe('payer, AMOUNT split', () => {
    it('gives the payer the remainder after subtracting the amounts assigned to others', () => {
      const exp = buildExpense({
        splitType: 'AMOUNT',
        splitWith: [{ id: GUEST_ID, name: 'Guest', email: 'guest@test.com' }],
        splitAmount: [40],
      });
      expect(calculateUserExpenseShare(exp, HOST_ID)).toBe(60);
    });

    it('gives the payer 0 when the full amount was assigned to others', () => {
      const exp = buildExpense({
        splitType: 'AMOUNT',
        splitWith: [{ id: GUEST_ID, name: 'Guest', email: 'guest@test.com' }],
        splitAmount: [100],
      });
      expect(calculateUserExpenseShare(exp, HOST_ID)).toBe(0);
    });
  });

  describe('payer, no split configured', () => {
    it('gives the payer the full amount when splitWith is empty', () => {
      const exp = buildExpense({ splitType: 'EQUAL', splitWith: [] });
      expect(calculateUserExpenseShare(exp, HOST_ID)).toBe(100);
    });
  });

  describe('split member (not the payer)', () => {
    it('gives an EQUAL split member their exact share', () => {
      const exp = buildExpense({
        splitType: 'EQUAL',
        splitWith: [
          { id: GUEST_ID, name: 'Guest', email: 'guest@test.com' },
          { id: OTHER_ID, name: 'Other', email: 'other@test.com' },
        ],
      });
      expect(calculateUserExpenseShare(exp, GUEST_ID)).toBe(50);
    });

    it('gives a PERCENTAGE split member their exact share', () => {
      const exp = buildExpense({
        splitType: 'PERCENTAGE',
        splitWith: [{ id: GUEST_ID, name: 'Guest', email: 'guest@test.com' }],
        splitPercentage: [100],
      });
      expect(calculateUserExpenseShare(exp, GUEST_ID)).toBe(100);
    });

    it('gives an AMOUNT split member their exact assigned amount', () => {
      const exp = buildExpense({
        splitType: 'AMOUNT',
        splitWith: [{ id: GUEST_ID, name: 'Guest', email: 'guest@test.com' }],
        splitAmount: [40],
      });
      expect(calculateUserExpenseShare(exp, GUEST_ID)).toBe(40);
    });

    it('gives 0 to someone not in the split and not the payer', () => {
      const exp = buildExpense({
        splitType: 'EQUAL',
        splitWith: [{ id: GUEST_ID, name: 'Guest', email: 'guest@test.com' }],
      });
      expect(calculateUserExpenseShare(exp, OTHER_ID)).toBe(0);
    });
  });
});
