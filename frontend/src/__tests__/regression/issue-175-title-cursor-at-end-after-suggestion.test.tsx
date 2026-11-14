/**
 * Regression test for issue #175: selecting a title suggestion left the typed
 * (partial) title in place, and label/theme of the past expense were not
 * carried over. Selecting now fills title, category, label and theme.
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

describe('issue #175: title cursor after selecting a suggestion', () => {
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

  async function typeAndSelect(match: { labelId: number | null; themeId: number | null }) {
    vi.mocked(suggestExpenses).mockResolvedValue({
      matches: [{ expenseId: 1, title: 'Dinner at Luigi', amount: 25, categoryId: 8, splitWithIds: [], ...match }],
      categorySuggestion: null,
    });
    const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as unknown as EditExpenseScreenProps['navigation'];
    const route = { params: { groupId: 1, groupName: 'G', groupCurrencyCode: 'GBP' } } as unknown as EditExpenseScreenProps['route'];
    const { container } = render(<EditExpenseScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-input')).not.toBeNull());
    fireEvent.change(byTestId(container, 'edit-expense-title-input') as HTMLElement, { target: { value: 'Din' } });
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-suggestion-1')).not.toBeNull(), { timeout: 2000 });
    fireEvent.click(byTestId(container, 'edit-expense-title-suggestion-1') as HTMLElement);
    return container;
  }

  it('should keep focus on the title with the cursor at the end after selecting', async () => {
    const container = await typeAndSelect({ labelId: null, themeId: null });

    await waitFor(() => expect((byTestId(container, 'edit-expense-title-input') as HTMLInputElement).value).toBe('Dinner at Luigi'));
    const input = byTestId(container, 'edit-expense-title-input') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe('Dinner at Luigi'.length);
    expect(input.selectionEnd).toBe('Dinner at Luigi'.length);
  });
});
