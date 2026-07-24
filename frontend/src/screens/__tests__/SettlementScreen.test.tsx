/**
 * SettlementScreen Tests
 *
 * ROADMAP.md flags "Settlement screen: rent expense missing from
 * calculation (data flow bug)". This suite characterizes current
 * behavior: the settlement calculation itself iterates the full
 * `expenses` array from route.params with no category filtering, so a
 * rent expense present in that array IS included correctly here. If the
 * roadmap bug is real, it likely lives upstream -- in what gets passed
 * into route.params.expenses before this screen ever renders -- not in
 * this component's math. These tests prove the math is not the bug;
 * they do not disprove the roadmap issue as a whole.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettlementScreen } from '../SettlementScreen';
import type { Expense } from '../../services/expenseService';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'user@test.com', name: 'Alice' } }),
}));

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: 1,
    title: 'Expense',
    amount: 100,
    currency: { id: 1, code: 'USD', label: 'US Dollar' },
    paidById: 1,
    paidBy: { id: 1, name: 'Alice', email: 'alice@test.com' },
    categoryId: 1,
    category: { id: 1, code: 'FOOD', label: 'Food' },
    splitWith: [],
    splitAmount: [],
    splitPercentage: [],
    splitType: 'EQUAL',
    expenseDate: '2026-04-11T12:00:00Z',
    createdAt: '2026-04-11T12:00:00Z',
    settled: false,
    ...overrides,
  } as Expense;
}

function renderSettlement(expenses: Expense[]) {
  const route = {
    params: {
      groupId: 1,
      groupName: 'Roommates',
      currency: { code: 'USD' },
      expenses,
    },
  } as any;
  return render(<SettlementScreen navigation={{} as any} route={route} />);
}

describe('SettlementScreen', () => {
  it('shows an empty state when there are no expenses', () => {
    renderSettlement([]);

    expect(screen.getByText('No settlement data')).toBeTruthy();
  });

  it('includes a rent-category expense in the settlement totals', () => {
    const rentExpense = makeExpense({
      id: 10,
      title: 'Monthly Rent',
      amount: 1000,
      category: { id: 2, code: 'RENT', label: 'Rent' },
      paidById: 1,
      paidBy: { id: 1, name: 'Alice', email: 'alice@test.com' },
      splitWith: [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
      ],
      splitType: 'EQUAL',
    });

    renderSettlement([rentExpense]);

    // Alice paid the full 1000 and owes her 500 share -> net +500 (will get back).
    expect(screen.getByText(/Alice will get USD 500\.00/)).toBeTruthy();
    // Bob owes his 500 share and paid nothing -> net -500 (needs to pay).
    expect(screen.getByText(/Bob needs to pay USD 500\.00/)).toBeTruthy();
  });

  it('combines a rent expense with other expenses in the same settlement', () => {
    const rentExpense = makeExpense({
      id: 10,
      category: { id: 2, code: 'RENT', label: 'Rent' },
      amount: 1000,
      paidById: 1,
      paidBy: { id: 1, name: 'Alice', email: 'alice@test.com' },
      splitWith: [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
      ],
      splitType: 'EQUAL',
    });
    const foodExpense = makeExpense({
      id: 11,
      category: { id: 1, code: 'FOOD', label: 'Food' },
      amount: 40,
      paidById: 2,
      paidBy: { id: 2, name: 'Bob', email: 'bob@test.com' },
      splitWith: [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
      ],
      splitType: 'EQUAL',
    });

    renderSettlement([rentExpense, foodExpense]);

    // Alice: paid 1000, owes 500 (rent) + 20 (food) = 520 -> net +480
    expect(screen.getByText(/Alice will get USD 480\.00/)).toBeTruthy();
    // Bob: paid 40, owes 500 (rent) + 20 (food) = 520 -> net -480
    expect(screen.getByText(/Bob needs to pay USD 480\.00/)).toBeTruthy();
  });
});
