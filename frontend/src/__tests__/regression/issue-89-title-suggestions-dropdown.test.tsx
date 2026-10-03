/**
 * Regression test for issue #89 (placeholder number -- rename once the
 * tracking issue is filed): the title-autocomplete suggestions rendered as an
 * always-expanding flat list inside the form, pushing the rest of the form
 * down. They now render in a bounded, scrollable overlay under the Title
 * field. (Duplicate titles and filler-word matches are fixed server-side; see
 * the backend issue-89 regression test.)
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

describe('issue #89: title suggestions render in a bounded scrollable dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue([{ id: 7, code: 'OTHER', label: 'Other' }] as Awaited<ReturnType<typeof getCategories>>);
    vi.mocked(getLabels).mockResolvedValue([]);
    vi.mocked(getThemes).mockResolvedValue([]);
    vi.mocked(getGroup).mockResolvedValue({ id: 1, members: [{ id: 1, name: 'Alice', email: 'a@test.com' }] } as unknown as Awaited<ReturnType<typeof getGroup>>);
  });

  it('should render many suggestions inside the dropdown container that holds a scroll view', async () => {
    const matches = Array.from({ length: 5 }, (_, i) => ({ expenseId: i + 1, title: `Dinner ${i}`, amount: 10, categoryId: 7, splitWithIds: [] }));
    vi.mocked(suggestExpenses).mockResolvedValue({ matches, categorySuggestion: null });
    const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as unknown as EditExpenseScreenProps['navigation'];
    const route = { params: { groupId: 1, groupName: 'G', groupCurrencyCode: 'GBP' } } as unknown as EditExpenseScreenProps['route'];
    const { container } = render(<EditExpenseScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(byTestId(container, 'edit-expense-title-input')).not.toBeNull());

    fireEvent.change(byTestId(container, 'edit-expense-title-input') as HTMLElement, { target: { value: 'Dinner' } });

    await waitFor(() => expect(byTestId(container, 'edit-expense-title-suggestions')).not.toBeNull(), { timeout: 2000 });
    const dropdown = byTestId(container, 'edit-expense-title-suggestions') as HTMLElement;
    for (let i = 1; i <= 5; i += 1) {
      expect(dropdown.contains(byTestId(container, `edit-expense-title-suggestion-${i}`))).toBe(true);
    }
  });

  it('should style the dropdown as an absolute, height-capped overlay (source-level guard)', () => {
    // jsdom cannot resolve React Native StyleSheet values, so guard the style
    // definition itself: reverting to a plain in-flow list would drop these.
    const src = fs.readFileSync(path.resolve(__dirname, '../../screens/EditExpenseScreen.tsx'), 'utf8');
    const match = src.match(/suggestionDropdown:\s*\{([^}]*)\}/);

    expect(match).not.toBeNull();
    expect(match?.[1]).toMatch(/position:\s*'absolute'/);
    expect(match?.[1]).toMatch(/maxHeight:\s*\d+/);
    expect(src).toMatch(/style=\{styles\.suggestionDropdown\}[\s\S]{0,200}<ScrollView/);
  });
});
