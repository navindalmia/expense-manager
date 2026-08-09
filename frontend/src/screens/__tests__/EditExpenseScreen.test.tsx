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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Platform } from 'react-native';
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
  deleteExpense: vi.fn(),
}));

import { getCategories } from '../../services/categoryService';
import { getGroup } from '../../services/groupService';
import { getExpenseById, deleteExpense } from '../../services/expenseService';

function renderEditScreen(expenseId: number) {
  const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as any;
  const route = {
    params: {
      expenseId,
      groupId: 1,
      groupName: 'Roommates',
      groupCurrencyCode: 'GBP',
    },
  } as any;
  return render(<EditExpenseScreen navigation={navigation} route={route} />);
}

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

  it('does not show a Delete button when creating a new expense (nothing to delete yet)', async () => {
    const { container } = renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Other')).toBeTruthy();
    });

    // RN's testID renders as a lowercase `testid` attribute on web, not
    // `data-testid` -- see the EDIT-mode delete tests below for the query helper.
    expect(container.querySelector('[testid="delete-expense-button"]')).toBeNull();
  });
});

describe('EditExpenseScreen (EDIT mode)', () => {
  const editModeMembers = [
    { id: 1, name: 'Alice', email: 'alice@test.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (getCategories as any).mockResolvedValue(mockCategories);
    (getGroup as any).mockResolvedValue({ id: 1, members: editModeMembers });
    (getExpenseById as any).mockResolvedValue({
      id: 42,
      title: 'Groceries',
      amount: 100,
      currency: { id: 1, code: 'GBP', label: 'British Pound' },
      paidById: 1,
      paidBy: editModeMembers[0],
      categoryId: 7,
      category: { id: 7, code: 'OTHER', label: 'Other' },
      splitType: 'AMOUNT',
      splitWith: editModeMembers,
      splitAmount: [60, 40],
      splitPercentage: [],
      expenseDate: '2026-04-11T12:00:00Z',
      createdAt: '2026-04-11T12:00:00Z',
      settled: false,
    });
  });

  it('shows the actual saved per-member AMOUNT split values, not 0 (regression: setSplitType ran after hydration and clobbered them)', async () => {
    renderEditScreen(42);

    await waitFor(() => {
      expect(screen.getByDisplayValue('60')).toBeTruthy();
    });

    expect(screen.getByDisplayValue('40')).toBeTruthy();
    expect(screen.queryByDisplayValue('0.00')).toBeNull();
    expect(screen.queryByDisplayValue('0')).toBeNull();
  });

  describe('Delete expense (web, Platform.OS === "web")', () => {
    const originalOS = Platform.OS;
    let confirmSpy: ReturnType<typeof vi.fn<[string?], boolean>>;

    beforeEach(() => {
      Platform.OS = 'web';
      confirmSpy = vi.spyOn(window, 'confirm') as unknown as ReturnType<typeof vi.fn<[string?], boolean>>;
    });

    afterEach(() => {
      Platform.OS = originalOS;
      confirmSpy.mockRestore();
    });

    function renderEditModeForDelete() {
      const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as any;
      const route = {
        params: { expenseId: 42, groupId: 1, groupName: 'Roommates', groupCurrencyCode: 'GBP' },
      } as any;
      const result = render(<EditExpenseScreen navigation={navigation} route={route} />);

      // RN's testID renders as a lowercase `testid` attribute on web, not
      // `data-testid` that @testing-library/react's getByTestId expects.
      const getDeleteButton = (): HTMLElement => {
        const el = result.container.querySelector('[testid="delete-expense-button"]');
        if (!el) throw new Error('Unable to find delete-expense-button');
        return el as HTMLElement;
      };

      return { navigation, getDeleteButton };
    }

    it('deletes the expense and navigates back when the confirmation is accepted', async () => {
      confirmSpy.mockReturnValue(true);
      (deleteExpense as any).mockResolvedValue(undefined);
      const { navigation, getDeleteButton } = renderEditModeForDelete();

      await waitFor(() => expect(getDeleteButton()).toBeTruthy());
      await userEvent.click(getDeleteButton());

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Groceries'));
      expect(deleteExpense).toHaveBeenCalledWith(42);
      await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    });

    it('does not delete the expense when the confirmation is dismissed', async () => {
      confirmSpy.mockReturnValue(false);
      const { navigation, getDeleteButton } = renderEditModeForDelete();

      await waitFor(() => expect(getDeleteButton()).toBeTruthy());
      await userEvent.click(getDeleteButton());

      expect(confirmSpy).toHaveBeenCalled();
      expect(deleteExpense).not.toHaveBeenCalled();
      expect(navigation.goBack).not.toHaveBeenCalled();
    });
  });
});
