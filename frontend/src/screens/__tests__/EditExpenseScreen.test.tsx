/**
 * EditExpenseScreen Tests (CREATE mode)
 *
 * GitHub issue #6: the category field used to default to null and
 * hard-block saving until the user manually picked a value. This suite
 * verifies the fix on the screen actually reached by "Add Expense" in
 * navigation (route "EditExpense", CREATE mode when no expenseId is
 * passed): category now defaults to the backend's "Other" category once
 * categories load, without requiring the user to touch the picker.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EditExpenseScreen from '../EditExpenseScreen';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockCategories = [
  { id: 1, code: 'FOOD', label: 'Food' },
  { id: 7, code: 'OTHER', label: 'Other' },
];

const mockGroupMembers = [
  { id: 1, name: 'Alice', email: 'alice@test.com' },
];

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'alice@test.com', name: 'Alice' } }),
}));

vi.mock('../../services/categoryService', () => ({
  getCategories: vi.fn(),
}));

vi.mock('../../services/groupService', () => ({
  getGroup: vi.fn(),
}));

vi.mock('../../services/expenseService', () => ({
  getExpenseById: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
}));

import { getCategories } from '../../services/categoryService';
import { getGroup } from '../../services/groupService';

function renderScreen() {
  const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as any;
  const route = {
    params: {
      // no expenseId => CREATE mode, matches how ExpenseListScreen navigates
      // to "Add Expense" (navigation.navigate('EditExpense', { groupId, ... }))
      groupId: 1,
      groupName: 'Roommates',
      groupCurrencyCode: 'GBP',
    },
  } as any;
  return render(<EditExpenseScreen navigation={navigation} route={route} />);
}

describe('EditExpenseScreen (CREATE mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCategories as any).mockResolvedValue(mockCategories);
    (getGroup as any).mockResolvedValue({ id: 1, members: mockGroupMembers });
  });

  it('defaults the category to "Other" once categories load, without the user picking one', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Other')).toBeTruthy();
    });

    expect(screen.queryByText('Select category...')).toBeNull();
  });

  it('defaults "Paid By" to the logged-in user, since they usually pay when adding the expense', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Select payer...')).toBeNull();
  });
});
