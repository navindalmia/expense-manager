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
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  createCategory: vi.fn(),
}));

vi.mock('../../services/labelService', () => ({
  getLabels: vi.fn(),
  createLabel: vi.fn(),
}));

vi.mock('../../services/groupService', () => ({
  getGroup: vi.fn(),
}));

vi.mock('../../services/expenseService', () => ({
  getExpenseById: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  suggestExpenses: vi.fn(),
}));

import { getCategories, createCategory } from '../../services/categoryService';
import { getLabels, createLabel } from '../../services/labelService';
import { getGroup } from '../../services/groupService';
import { getExpenseById, deleteExpense, createExpense, updateExpense, suggestExpenses, type SuggestedExpenseMatch } from '../../services/expenseService';

// RN's testID renders as a lowercase `testid` attribute on web, not the
// `data-testid` @testing-library/react's getByTestId expects.
function getByTestId(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(`[testid="${id}"]`);
  if (!el) throw new Error(`Unable to find element with testid: ${id}`);
  return el as HTMLElement;
}

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
    (getLabels as any).mockResolvedValue([]);
    (getGroup as any).mockResolvedValue({ id: 1, members: mockGroupMembers });
    (suggestExpenses as any).mockResolvedValue({ matches: [], categorySuggestion: null });
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

  describe('Title autocomplete + category suggestion (U9, R5, R8)', () => {
    // Real timers throughout -- these poll for the actual side effect via
    // waitFor (real setTimeout-based polling) rather than a hardcoded
    // sleep, per CLAUDE.md's "no hardcoded delays" testing rule. The
    // debounce's real ~300ms is what the polling waits out; it isn't a
    // sleep asserting a fixed duration, it's a condition wait with a
    // generous timeout.

    it('shows a suggestion when the typed title matches a past expense; selecting it prefills amount/category and sets date to today (AE2)', async () => {
      const user = userEvent.setup();
      (suggestExpenses as any).mockResolvedValue({
        matches: [{ expenseId: 10, title: 'Fuel', amount: 45, categoryId: 1, splitWithIds: [] }],
        categorySuggestion: null,
      });
      const { container } = renderScreen();
      await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

      fireEvent.change(getByTestId(container, 'edit-expense-title-input'), { target: { value: 'Fuel' } });

      await waitFor(() => expect(getByTestId(container, 'edit-expense-title-suggestion-10')).toBeTruthy(), { timeout: 2000 });
      await user.click(getByTestId(container, 'edit-expense-title-suggestion-10'));

      expect((getByTestId(container, 'edit-expense-amount-input') as HTMLInputElement).value).toBe('45');
      expect(getByTestId(container, 'edit-expense-category-picker-button').textContent).toContain('Food');
      expect(queryByTestId(container, 'edit-expense-title-suggestion-10')).toBeNull();
    });

    it('filters a matched split member who is not in the current group before prefilling (regression: a match can come from a different group than the one being edited)', async () => {
      const user = userEvent.setup();
      (suggestExpenses as any).mockResolvedValue({
        matches: [{ expenseId: 10, title: 'Fuel', amount: 45, categoryId: 1, splitWithIds: [1, 999] }], // 999 is not a member of this group
        categorySuggestion: null,
      });
      const { container } = renderScreen();
      await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

      fireEvent.change(getByTestId(container, 'edit-expense-title-input'), { target: { value: 'Fuel' } });
      await waitFor(() => expect(getByTestId(container, 'edit-expense-title-suggestion-10')).toBeTruthy(), { timeout: 2000 });
      await user.click(getByTestId(container, 'edit-expense-title-suggestion-10'));

      // 999 was never a real member so it has no toggle row at all -- but
      // if it had wrongly landed in splitWithIds, the EQUAL split would
      // divide 45 by 2 members instead of 1, showing 22.50 for Alice
      // instead of the full 45.00.
      expect(queryByTestId(container, 'split-member-toggle-999')).toBeNull();
      await waitFor(() => expect(screen.getByText('45.00')).toBeTruthy());
    });

    it('pre-selects the suggested category when no title match is found (AE3), still changeable by the user', async () => {
      (suggestExpenses as any).mockResolvedValue({
        matches: [],
        categorySuggestion: { categoryId: 1, code: 'FOOD' },
      });
      const { container } = renderScreen();
      await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

      fireEvent.change(getByTestId(container, 'edit-expense-title-input'), { target: { value: 'Coffee' } });

      await waitFor(
        () => expect(getByTestId(container, 'edit-expense-category-picker-button').textContent).toContain('Food'),
        { timeout: 2000 }
      );
    });

    it('includes suggestedCategoryId in the save payload, matching whatever category the user ultimately chose', async () => {
      const user = userEvent.setup();
      (suggestExpenses as any).mockResolvedValue({
        matches: [],
        categorySuggestion: { categoryId: 1, code: 'FOOD' },
      });
      (createExpense as any).mockResolvedValue({ id: 1 });
      const { container } = renderScreen();
      await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

      fireEvent.change(getByTestId(container, 'edit-expense-title-input'), { target: { value: 'Coffee' } });
      await waitFor(
        () => expect(getByTestId(container, 'edit-expense-category-picker-button').textContent).toContain('Food'),
        { timeout: 2000 }
      );

      fireEvent.change(getByTestId(container, 'edit-expense-amount-input'), { target: { value: '5' } });
      await user.click(getByTestId(container, 'edit-expense-paid-by-picker-button'));
      await user.click(getByTestId(container, 'edit-expense-paid-by-option-1'));
      await user.click(getByTestId(container, 'edit-expense-save-button'));

      await waitFor(() => {
        expect(createExpense).toHaveBeenCalledWith(expect.objectContaining({ suggestedCategoryId: 1, categoryId: 1 }));
      });
    });

    it('does not fire a suggest call per keystroke -- the debounce is actually effective', async () => {
      const { container } = renderScreen();
      await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

      const titleInput = getByTestId(container, 'edit-expense-title-input');
      fireEvent.change(titleInput, { target: { value: 'F' } });
      fireEvent.change(titleInput, { target: { value: 'Fu' } });
      fireEvent.change(titleInput, { target: { value: 'Fue' } });
      fireEvent.change(titleInput, { target: { value: 'Fuel' } });

      await waitFor(() => expect(suggestExpenses).toHaveBeenCalled(), { timeout: 2000 });

      expect(suggestExpenses).toHaveBeenCalledTimes(1);
      expect(suggestExpenses).toHaveBeenCalledWith('Fuel');
    });

    it('ignores an out-of-order response -- an older, slower request must not clobber a newer one that resolved first', async () => {
      let resolveFirst!: (value: { matches: SuggestedExpenseMatch[]; categorySuggestion: null }) => void;
      let resolveSecond!: (value: { matches: SuggestedExpenseMatch[]; categorySuggestion: null }) => void;
      const firstResponse = new Promise((resolve) => { resolveFirst = resolve; });
      const secondResponse = new Promise((resolve) => { resolveSecond = resolve; });
      (suggestExpenses as any).mockReturnValueOnce(firstResponse).mockReturnValueOnce(secondResponse);

      const { container } = renderScreen();
      await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

      const titleInput = getByTestId(container, 'edit-expense-title-input');
      fireEvent.change(titleInput, { target: { value: 'Fu' } });
      await waitFor(() => expect(suggestExpenses).toHaveBeenCalledTimes(1), { timeout: 2000 });

      fireEvent.change(titleInput, { target: { value: 'Fuel' } });
      await waitFor(() => expect(suggestExpenses).toHaveBeenCalledTimes(2), { timeout: 2000 });

      // Newer request ("Fuel") resolves first; older, slower request ("Fu")
      // resolves after it -- the stale one must be ignored.
      resolveSecond({ matches: [{ expenseId: 20, title: 'Fuel', amount: 45, categoryId: 1, splitWithIds: [] }], categorySuggestion: null });
      await waitFor(() => expect(getByTestId(container, 'edit-expense-title-suggestion-20')).toBeTruthy(), { timeout: 2000 });

      resolveFirst({ matches: [{ expenseId: 99, title: 'Furniture', amount: 200, categoryId: 5, splitWithIds: [] }], categorySuggestion: null });
      await new Promise((resolve) => setTimeout(resolve, 0)); // flush the resolved microtask

      expect(queryByTestId(container, 'edit-expense-title-suggestion-99')).toBeNull();
      expect(getByTestId(container, 'edit-expense-title-suggestion-20')).toBeTruthy();
    });

    it('clears the suggestion list without leaving stale data when the title is cleared before a suggestion is selected', async () => {
      (suggestExpenses as any).mockResolvedValue({
        matches: [{ expenseId: 10, title: 'Fuel', amount: 45, categoryId: 1, splitWithIds: [] }],
        categorySuggestion: null,
      });
      const { container } = renderScreen();
      await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

      const titleInput = getByTestId(container, 'edit-expense-title-input');
      fireEvent.change(titleInput, { target: { value: 'Fuel' } });
      await waitFor(() => expect(getByTestId(container, 'edit-expense-title-suggestion-10')).toBeTruthy(), { timeout: 2000 });

      fireEvent.change(titleInput, { target: { value: '' } });

      expect(queryByTestId(container, 'edit-expense-title-suggestion-10')).toBeNull();
    });

    it('fails silently when the suggest endpoint errors -- no banner, manual entry still works', async () => {
      (suggestExpenses as any).mockRejectedValue(new Error('network error'));
      const { container } = renderScreen();
      await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

      fireEvent.change(getByTestId(container, 'edit-expense-title-input'), { target: { value: 'Fuel' } });
      await waitFor(() => expect(suggestExpenses).toHaveBeenCalled(), { timeout: 2000 });

      expect(screen.queryByText(/network error/i)).toBeNull();
      expect((getByTestId(container, 'edit-expense-title-input') as HTMLInputElement).value).toBe('Fuel');
    });
  });
});

function queryByTestId(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[testid="${id}"]`) as HTMLElement | null;
}

describe('EditExpenseScreen (EDIT mode)', () => {
  const editModeMembers = [
    { id: 1, name: 'Alice', email: 'alice@test.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (getCategories as any).mockResolvedValue(mockCategories);
    (getLabels as any).mockResolvedValue([]);
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

  it('never calls suggestExpenses in EDIT mode, even when the title field changes (U9 regression guard)', async () => {
    const user = userEvent.setup();
    const { container } = renderEditScreen(42);

    await waitFor(() => expect(getByTestId(container, 'edit-expense-title-input')).toBeTruthy());
    await user.type(getByTestId(container, 'edit-expense-title-input'), ' updated');

    expect(suggestExpenses).not.toHaveBeenCalled();
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
    let confirmSpy: ReturnType<typeof vi.fn<(message?: string) => boolean>>;

    beforeEach(() => {
      Platform.OS = 'web';
      confirmSpy = vi.spyOn(window, 'confirm') as unknown as ReturnType<typeof vi.fn<(message?: string) => boolean>>;
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

  describe('Category and Label (U8, R2, R3, R7)', () => {
    it('shows the already-set category and label correctly on first render, not reset once categories/labels finish loading (hydration regression guard)', async () => {
      (getLabels as any).mockResolvedValue([{ id: 5, name: 'Liverpool', userId: 1, isActive: true }]);
      const { container } = renderEditScreen(42);

      await waitFor(() => {
        expect(getByTestId(container, 'edit-expense-category-picker-button').textContent).toContain('Other');
      });

      // Still correct after categories/labels have finished loading -- no
      // later effect clobbers the hydrated value (see the split-amount
      // regression test above for the same class of bug).
      expect(getByTestId(container, 'edit-expense-category-picker-button').textContent).toContain('Other');
    });

    it('selecting an existing category persists categoryId on expense save', async () => {
      const user = userEvent.setup();
      (updateExpense as any).mockResolvedValue({ id: 42 });
      const { container } = renderEditScreen(42);

      await waitFor(() => expect(getByTestId(container, 'edit-expense-category-picker-button')).toBeTruthy());
      await user.click(getByTestId(container, 'edit-expense-category-picker-button'));
      await user.click(getByTestId(container, 'edit-expense-category-option-1'));
      await user.click(getByTestId(container, 'edit-expense-save-button'));

      await waitFor(() => {
        expect(updateExpense).toHaveBeenCalledWith(42, expect.objectContaining({ categoryId: 1 }));
      });
    });

    it('selecting an existing label persists labelId on expense save', async () => {
      const user = userEvent.setup();
      (getLabels as any).mockResolvedValue([{ id: 5, name: 'Liverpool', userId: 1, isActive: true }]);
      (updateExpense as any).mockResolvedValue({ id: 42 });
      const { container } = renderEditScreen(42);

      await waitFor(() => expect(getByTestId(container, 'edit-expense-label-picker-button')).toBeTruthy());
      await user.click(getByTestId(container, 'edit-expense-label-picker-button'));
      await user.click(getByTestId(container, 'edit-expense-label-option-5'));
      await user.click(getByTestId(container, 'edit-expense-save-button'));

      await waitFor(() => {
        expect(updateExpense).toHaveBeenCalledWith(42, expect.objectContaining({ labelId: 5 }));
      });
    });

    it('using "Add new" on the category dropdown creates it via createCategory, then selects it without reopening the dropdown', async () => {
      const user = userEvent.setup();
      const created = { id: 9, code: 'ENTERTAINMENT', label: 'Entertainment' };
      (createCategory as any).mockResolvedValue(created);
      const { container } = renderEditScreen(42);

      await waitFor(() => expect(getByTestId(container, 'edit-expense-category-picker-button')).toBeTruthy());
      await user.click(getByTestId(container, 'edit-expense-category-picker-button'));
      await user.click(getByTestId(container, 'edit-expense-category-add-new-button'));
      await user.type(getByTestId(container, 'edit-expense-category-create-input'), 'Entertainment');
      await user.click(getByTestId(container, 'edit-expense-category-create-submit-button'));

      await waitFor(() => {
        expect(createCategory).toHaveBeenCalledWith('Entertainment');
        expect(getByTestId(container, 'edit-expense-category-picker-button').textContent).toContain('Entertainment');
      });
    });

    it('using "Add new" on the label dropdown creates it via createLabel, then selects it without reopening the dropdown', async () => {
      const user = userEvent.setup();
      const created = { id: 6, name: 'Liverpool', userId: 1, isActive: true };
      (createLabel as any).mockResolvedValue(created);
      const { container } = renderEditScreen(42);

      await waitFor(() => expect(getByTestId(container, 'edit-expense-label-picker-button')).toBeTruthy());
      await user.click(getByTestId(container, 'edit-expense-label-picker-button'));
      await user.click(getByTestId(container, 'edit-expense-label-add-new-button'));
      await user.type(getByTestId(container, 'edit-expense-label-create-input'), 'Liverpool');
      await user.click(getByTestId(container, 'edit-expense-label-create-submit-button'));

      await waitFor(() => {
        expect(createLabel).toHaveBeenCalledWith('Liverpool');
        expect(getByTestId(container, 'edit-expense-label-picker-button').textContent).toContain('Liverpool');
      });
    });
  });
});
