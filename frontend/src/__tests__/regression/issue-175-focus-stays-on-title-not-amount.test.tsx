/**
 * Issue #175: on Android, focus landed in Amount after picking a suggestion
 * (the dropdown overlays the Amount field). Focus must stay on the Title.
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
  getExpenseById: vi.fn(), createExpense: vi.fn(), updateExpense: vi.fn(), deleteExpense: vi.fn(), suggestExpenses: vi.fn(),
}));

import { getCategories } from '../../services/categoryService';
import { getLabels } from '../../services/labelService';
import { getThemes } from '../../services/themeService';
import { getGroup } from '../../services/groupService';
import { suggestExpenses } from '../../services/expenseService';

const byTestId = (c: HTMLElement, id: string): HTMLElement | null => c.querySelector(`[testid="${id}"]`);

describe('issue #175: focus stays on the title after selecting a suggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([{ id: 8, code: 'FOOD', label: 'Food' }] as Awaited<ReturnType<typeof getCategories>>);
    vi.mocked(getLabels).mockResolvedValue([]);
    vi.mocked(getThemes).mockResolvedValue([]);
    vi.mocked(getGroup).mockResolvedValue({ id: 1, members: [{ id: 1, name: 'Alice', email: 'a@test.com' }] } as unknown as Awaited<ReturnType<typeof getGroup>>);
    vi.mocked(suggestExpenses).mockResolvedValue({
      matches: [{ expenseId: 1, title: 'Dinner at Luigi', amount: 25, categoryId: 8, labelId: null, themeId: null, splitWithIds: [] }],
      categorySuggestion: null,
    });
  });

  it('should hand focus back to the title when Amount grabs it right after selection', async () => {
    const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as unknown as EditExpenseScreenProps['navigation'];
    const route = { params: { groupId: 1, groupName: 'G', groupCurrencyCode: 'GBP' } } as unknown as EditExpenseScreenProps['route'];
    const { container } = render(<EditExpenseScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-input')).not.toBeNull());
    fireEvent.change(byTestId(container, 'edit-expense-title-input') as HTMLElement, { target: { value: 'Din' } });
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-suggestion-1')).not.toBeNull(), { timeout: 2000 });
    fireEvent.click(byTestId(container, 'edit-expense-title-suggestion-1') as HTMLElement);

    (byTestId(container, 'edit-expense-amount-input') as HTMLElement).focus();

    const title = byTestId(container, 'edit-expense-title-input') as HTMLInputElement;
    expect(document.activeElement).toBe(title);
    expect(document.activeElement).not.toBe(byTestId(container, 'edit-expense-amount-input'));
  });
});
