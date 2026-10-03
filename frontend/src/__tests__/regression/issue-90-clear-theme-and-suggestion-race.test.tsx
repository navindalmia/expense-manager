/**
 * Issue #90 (PR #90 review):
 *  D. a theme could never be cleared once set -- the form sent
 *     `themeId: undefined`, which the backend reads as "unchanged".
 *  E. picking a suggestion/category while a debounced suggest request was
 *     pending let the stale response reopen matches / overwrite the category.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import EditExpenseScreen from '../../screens/EditExpenseScreen';
import type { EditExpenseScreenProps } from '../../types/navigation';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'alice@test.com', name: 'Alice' } }),
}));
vi.mock('../../services/categoryService', () => ({ getCategories: vi.fn(), createCategory: vi.fn() }));
vi.mock('../../services/labelService', () => ({ getLabels: vi.fn(), createLabel: vi.fn() }));
vi.mock('../../services/themeService', () => ({ getThemes: vi.fn(), createTheme: vi.fn() }));
vi.mock('../../services/groupService', () => ({ getGroup: vi.fn() }));
vi.mock('../../services/expenseService', () => ({
  getExpenseById: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  suggestExpenses: vi.fn(),
}));

import { getCategories } from '../../services/categoryService';
import { getLabels } from '../../services/labelService';
import { getThemes } from '../../services/themeService';
import { getGroup } from '../../services/groupService';
import { getExpenseById, updateExpense, suggestExpenses } from '../../services/expenseService';

type SuggestResult = Awaited<ReturnType<typeof suggestExpenses>>;

const members = [{ id: 1, name: 'Alice', email: 'alice@test.com' }];

function byTestId(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[testid="${id}"]`);
}

function renderScreen(expenseId?: number) {
  const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as unknown as EditExpenseScreenProps['navigation'];
  const route = {
    params: { ...(expenseId ? { expenseId } : {}), groupId: 1, groupName: 'G', groupCurrencyCode: 'GBP' },
  } as unknown as EditExpenseScreenProps['route'];
  return render(<EditExpenseScreen navigation={navigation} route={route} />);
}

function mockCommon(): void {
  vi.mocked(getCategories).mockResolvedValue([
    { id: 1, code: 'FOOD', label: 'Food' },
    { id: 3, code: 'TRAVEL', label: 'Travel' },
    { id: 7, code: 'OTHER', label: 'Other' },
  ] as Awaited<ReturnType<typeof getCategories>>);
  vi.mocked(getLabels).mockResolvedValue([]);
  vi.mocked(getGroup).mockResolvedValue({ id: 1, members } as unknown as Awaited<ReturnType<typeof getGroup>>);
}

describe('issue #90 D: clearing a theme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommon();
    vi.mocked(getThemes).mockResolvedValue([{ id: 4, name: 'Holiday', userId: 1, isActive: true }] as Awaited<ReturnType<typeof getThemes>>);
    vi.mocked(getExpenseById).mockResolvedValue({
      id: 42, title: 'Groceries', amount: 100, currency: { id: 1, code: 'GBP', label: 'GBP' },
      paidById: 1, paidBy: members[0], categoryId: 7, category: { id: 7, code: 'OTHER', label: 'Other' },
      themeId: 4, splitType: 'AMOUNT', splitWith: members, splitAmount: [100], splitPercentage: [],
      expenseDate: '2026-04-11T12:00:00Z', createdAt: '2026-04-11T12:00:00Z', settled: false,
    } as unknown as Awaited<ReturnType<typeof getExpenseById>>);
    vi.mocked(updateExpense).mockResolvedValue({ id: 42 } as Awaited<ReturnType<typeof updateExpense>>);
  });

  it('should send themeId: null when the user picks "No theme" on an expense that had a theme', async () => {
    const { container } = renderScreen(42);
    await waitFor(() => expect(byTestId(container, 'edit-expense-theme-picker-button')?.textContent).toContain('Holiday'));

    fireEvent.click(byTestId(container, 'edit-expense-theme-picker-button') as HTMLElement);
    fireEvent.click(byTestId(container, 'edit-expense-theme-option-0') as HTMLElement);
    fireEvent.click(byTestId(container, 'edit-expense-save-button') as HTMLElement);

    await waitFor(() => expect(updateExpense).toHaveBeenCalled());
    expect(vi.mocked(updateExpense).mock.calls[0][1].themeId).toBeNull();
  });

  it('should keep sending the existing themeId when the theme was not touched', async () => {
    const { container } = renderScreen(42);
    await waitFor(() => expect(byTestId(container, 'edit-expense-theme-picker-button')?.textContent).toContain('Holiday'));

    fireEvent.click(byTestId(container, 'edit-expense-save-button') as HTMLElement);

    await waitFor(() => expect(updateExpense).toHaveBeenCalled());
    expect(vi.mocked(updateExpense).mock.calls[0][1].themeId).toBe(4);
  });
});

describe('issue #90 E: stale suggestion response after the user chose a value', () => {
  let resolveSecond: (value: SuggestResult) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suggestExpenses).mockReset(); // drop leftover once-queues
    mockCommon();
    vi.mocked(getThemes).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function typeAndFlush(container: HTMLElement, value: string): Promise<void> {
    fireEvent.change(byTestId(container, 'edit-expense-title-input') as HTMLElement, { target: { value } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
  }

  async function setupWithFirstMatchShown(): Promise<HTMLElement> {
    vi.mocked(suggestExpenses)
      .mockResolvedValueOnce({ matches: [{ expenseId: 10, title: 'Fuel', amount: 45, categoryId: 1, splitWithIds: [] }], categorySuggestion: null })
      .mockImplementationOnce(() => new Promise<SuggestResult>((resolve) => { resolveSecond = resolve; }));
    const { container } = renderScreen();
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-input')).not.toBeNull());
    vi.useFakeTimers();
    await typeAndFlush(container, 'Fue');
    expect(byTestId(container, 'edit-expense-title-suggestion-10')).not.toBeNull();
    return container;
  }

  it('should not fire the pending debounced request after a suggestion is picked', async () => {
    const container = await setupWithFirstMatchShown();

    fireEvent.change(byTestId(container, 'edit-expense-title-input') as HTMLElement, { target: { value: 'Fuel' } });
    fireEvent.click(byTestId(container, 'edit-expense-title-suggestion-10') as HTMLElement);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(suggestExpenses).toHaveBeenCalledTimes(1);
  });

  it('should ignore an in-flight response that resolves after a suggestion is picked', async () => {
    const container = await setupWithFirstMatchShown();
    await typeAndFlush(container, 'Fuel'); // second request now in flight
    expect(suggestExpenses).toHaveBeenCalledTimes(2);

    fireEvent.click(byTestId(container, 'edit-expense-title-suggestion-10') as HTMLElement);
    await act(async () => {
      resolveSecond({
        matches: [{ expenseId: 11, title: 'Fuel stop', amount: 9, categoryId: 3, splitWithIds: [] }],
        categorySuggestion: null,
      });
    });

    expect(byTestId(container, 'edit-expense-title-suggestion-11')).toBeNull();
    expect(byTestId(container, 'edit-expense-title-suggestion-10')).toBeNull();
    expect(byTestId(container, 'edit-expense-category-picker-button')?.textContent).toContain('Food');
  });

  it('should not let a late category suggestion overwrite a category picked manually', async () => {
    const container = await setupWithFirstMatchShown();
    await typeAndFlush(container, 'Fuel'); // second request in flight

    fireEvent.click(byTestId(container, 'edit-expense-category-picker-button') as HTMLElement);
    fireEvent.click(byTestId(container, 'edit-expense-category-option-3') as HTMLElement);
    await act(async () => {
      resolveSecond({ matches: [], categorySuggestion: { categoryId: 1 } as SuggestResult['categorySuggestion'] });
    });

    expect(byTestId(container, 'edit-expense-category-picker-button')?.textContent).toContain('Travel');
  });
});
