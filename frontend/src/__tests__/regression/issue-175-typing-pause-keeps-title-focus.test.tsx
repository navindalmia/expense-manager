/**
 * While typing a title, the debounced suggestion fetch mounting the dropdown
 * moved focus to Amount on Android (reproduced in production). The Title must
 * keep focus and its element, and the parent section must not change style
 * when suggestions appear.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
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

describe('issue #175: typing pause must not move focus to Amount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([{ id: 8, code: 'FOOD', label: 'Food' }] as Awaited<ReturnType<typeof getCategories>>);
    vi.mocked(getLabels).mockResolvedValue([]);
    vi.mocked(getThemes).mockResolvedValue([]);
    vi.mocked(getGroup).mockResolvedValue({ id: 1, members: [{ id: 1, name: 'Alice', email: 'a@test.com' }] } as unknown as Awaited<ReturnType<typeof getGroup>>);
    vi.mocked(suggestExpenses).mockResolvedValue({
      matches: [{ expenseId: 1, title: 'Dinner at Luigi', amount: 25, categoryId: 8, labelId: null, themeId: null, splitWithIds: [] }],
      categorySuggestion: { categoryId: 8, code: 'FOOD', source: 'history' },
    });
  });

  it('should keep the same title element focused and hand back stray Amount focus when the dropdown appears', async () => {
    const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as unknown as EditExpenseScreenProps['navigation'];
    const route = { params: { groupId: 1, groupName: 'G', groupCurrencyCode: 'GBP' } } as unknown as EditExpenseScreenProps['route'];
    const { container } = render(<EditExpenseScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-input')).not.toBeNull());
    const title = byTestId(container, 'edit-expense-title-input') as HTMLInputElement;
    title.focus();
    fireEvent.change(title, { target: { value: 'Din' } });
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-suggestions')).not.toBeNull(), { timeout: 2000 });

    expect(byTestId(container, 'edit-expense-title-input')).toBe(title);
    (byTestId(container, 'edit-expense-amount-input') as HTMLElement).focus();
    expect(document.activeElement).toBe(title);
  });

  it('should not change the title section style when suggestions appear (source guard)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../screens/EditExpenseScreen.tsx'), 'utf8');
    expect(src).not.toMatch(/suggestedMatches\.length > 0 && styles\.formSectionRaised/);
  });
});
