/**
 * Issue #90: the title autocomplete dropdown must dismiss when the title
 * input loses focus (e.g. user taps Amount/Notes and types there).
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

describe('issue 90: title suggestions dismiss when the title field loses focus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([{ id: 7, code: 'OTHER', label: 'Other' }] as Awaited<ReturnType<typeof getCategories>>);
    vi.mocked(getLabels).mockResolvedValue([]);
    vi.mocked(getThemes).mockResolvedValue([]);
    vi.mocked(getGroup).mockResolvedValue({ id: 1, members: [{ id: 1, name: 'Alice', email: 'a@test.com' }] } as unknown as Awaited<ReturnType<typeof getGroup>>);
    vi.mocked(suggestExpenses).mockResolvedValue({
      matches: [{ expenseId: 1, title: 'Dinner out', amount: 10, categoryId: 7, splitWithIds: [] }],
      categorySuggestion: null,
    });
  });

  async function openWithSuggestions() {
    const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as unknown as EditExpenseScreenProps['navigation'];
    const route = { params: { groupId: 1, groupName: 'G', groupCurrencyCode: 'GBP' } } as unknown as EditExpenseScreenProps['route'];
    const { container } = render(<EditExpenseScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-input')).not.toBeNull());
    const title = byTestId(container, 'edit-expense-title-input') as HTMLElement;
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: 'Dinner' } });
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-suggestions')).not.toBeNull(), { timeout: 2000 });
    return { container, title };
  }

  it('should hide the dropdown when the title input blurs', async () => {
    const { container, title } = await openWithSuggestions();
    fireEvent.blur(title);
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-suggestions')).toBeNull());
  });
});
