/**
 * Issue #175: label/theme edge branches of selecting a suggestion.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
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
import { suggestExpenses } from '../../services/expenseService';

function byTestId(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[testid="${id}"]`);
}

describe('issue #175: label/theme branches when selecting a suggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([
      { id: 7, code: 'OTHER', label: 'Other' },
      { id: 8, code: 'FOOD', label: 'Food' },
    ] as Awaited<ReturnType<typeof getCategories>>);
    vi.mocked(getLabels).mockResolvedValue([{ id: 3, name: 'Liverpool' }] as Awaited<ReturnType<typeof getLabels>>);
    vi.mocked(getThemes).mockResolvedValue([{ id: 4, name: 'Monthly' }] as Awaited<ReturnType<typeof getThemes>>);
    vi.mocked(getGroup).mockResolvedValue({ id: 1, members: [{ id: 1, name: 'Alice', email: 'a@test.com' }] } as unknown as Awaited<ReturnType<typeof getGroup>>);
  });

  async function open() {
    const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as unknown as EditExpenseScreenProps['navigation'];
    const route = { params: { groupId: 1, groupName: 'G', groupCurrencyCode: 'GBP' } } as unknown as EditExpenseScreenProps['route'];
    const { container } = render(<EditExpenseScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-input')).not.toBeNull());
    return container;
  }

  async function pick(container: HTMLElement, match: { labelId: number | null; themeId: number | null }) {
    vi.mocked(suggestExpenses).mockResolvedValue({
      matches: [{ expenseId: 1, title: 'Dinner at Luigi', amount: 25, categoryId: 8, splitWithIds: [], ...match }],
      categorySuggestion: null,
    });
    fireEvent.change(byTestId(container, 'edit-expense-title-input') as HTMLElement, { target: { value: 'Din' } });
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-suggestion-1')).not.toBeNull(), { timeout: 2000 });
    fireEvent.click(byTestId(container, 'edit-expense-title-suggestion-1') as HTMLElement);
    await waitFor(() => expect((byTestId(container, 'edit-expense-title-input') as HTMLInputElement).value).toBe('Dinner at Luigi'));
  }

  it('should skip a label and theme that are not in the user lists', async () => {
    const container = await open();

    await pick(container, { labelId: 99, themeId: 98 });

    expect(container.textContent).toContain('Select label...');
    expect(container.textContent).toContain('Select theme...');
  });

  it('should keep a label the user already chose when the past expense had no label', async () => {
    const container = await open();
    fireEvent.click(byTestId(container, 'edit-expense-label-picker-button') as HTMLElement);
    await waitFor(() => expect(byTestId(container, 'edit-expense-label-option-3')).not.toBeNull());
    fireEvent.click(byTestId(container, 'edit-expense-label-option-3') as HTMLElement);
    await waitFor(() => expect(container.textContent).toContain('Liverpool'));

    await pick(container, { labelId: null, themeId: null });

    expect(container.textContent).toContain('Liverpool');
  });
});
