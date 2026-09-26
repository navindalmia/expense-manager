/**
 * Regression test for GitHub issue #45.
 *
 * ROOT CAUSE: bottom-sheet-style Modals (the "Who Paid?" / "Split Type" /
 * category-and-label TypeAheadDropdown pickers) render as a separate
 * native layer that does NOT inherit the parent screen's SafeAreaView
 * insets. Their content was wrapped in a plain `View`, so on a device
 * with Android's 3-button system navigation bar, the nav bar icons
 * physically overlapped the bottom row of the picker list (confirmed via
 * a real user screenshot showing the last member's row obscured).
 *
 * The fix wraps each picker's content in a `SafeAreaView` (matching the
 * pattern `DatePickerModal` already used correctly), so the system
 * nav bar's bottom inset is respected and the last row + Done button
 * stay above it.
 *
 * A second, related root cause surfaced in the same session: whole
 * screens (HomeScreen, ExpenseListScreen, SettlementScreen,
 * CreateExpenseScreen) also render their root list/scroll content in a
 * plain `View`/`KeyboardAvoidingView` with no SafeAreaView anywhere,
 * so their last visible row/button can be obscured by the system nav
 * bar too. Those are covered by a source-level check below, since they
 * require heavier navigation/data mocking to fully render.
 *
 * jsdom cannot compute real safe-area-inset-* CSS values, so this suite
 * verifies structure (the picker content is wrapped by a SafeAreaView,
 * not a plain View) rather than pixel-accurate inset values -- that is
 * confirmed instead via the manual Android-emulator screenshots recorded
 * for this fix (see PR description / docs/solutions).
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import EditExpenseScreen from '../../screens/EditExpenseScreen';
import type { EditExpenseScreenProps } from '../../types/navigation';
import TypeAheadDropdown from '../../components/TypeAheadDropdown';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------
// Part 1: EditExpenseScreen's "Who Paid?" and "Split Type" bottom-sheet
// pickers -- the two instances the issue's screenshot and the follow-up
// scope check (task item 1) identified in this file.
// ---------------------------------------------------------------------

const mockCategories = [
  { id: 1, code: 'FOOD', label: 'Food' },
  { id: 7, code: 'OTHER', label: 'Other' },
];

const mockGroupMembers = [
  { id: 1, name: 'Alice', email: 'alice@test.com' },
  { id: 2, name: 'Nav', email: 'nav@test.com' }, // last member -- the one the real screenshot showed hidden behind the nav bar
];


// Behavioral safe-area mock: insets.bottom = 48 (Android 3-button nav bar).
// Like the real SafeAreaView, this applies the inset as bottom padding.
// A plain View (the pre-fix code) gets no padding, so the last row is not cleared.
const NAV_BAR_INSET = 48;
vi.mock('react-native-safe-area-context', () => {
  const useSafeAreaInsets = (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 48,
    left: 0,
    right: 0,
  });
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }): React.ReactElement => <div>{children}</div>,
    useSafeAreaInsets,
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }): React.ReactElement => (
      <div data-rn-safe-area-view="true" data-padding-bottom={useSafeAreaInsets().bottom} {...props}>{children}</div>
    ),
  };
});

function expectClearsNavBar(wrapper: Element | null, ...rows: HTMLElement[]) {
  expect(wrapper).not.toBeNull();
  // Must be the modal's OWN wrapper, not the screen-root SafeAreaView (a Modal
  // is a separate native layer that does not inherit the screen's insets).
  expect(wrapper?.querySelector('[testid$="-picker-button"]')).toBeNull();
  expect(Number(wrapper?.getAttribute('data-padding-bottom'))).toBe(NAV_BAR_INSET);
  for (const row of rows) expect(wrapper?.contains(row)).toBe(true);
}

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

import { getCategories } from '../../services/categoryService';
import { getLabels } from '../../services/labelService';
import { getGroup } from '../../services/groupService';
import { suggestExpenses } from '../../services/expenseService';

// RN's testID renders as a lowercase `testid` attribute on web.
function getByTestId(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(`[testid="${id}"]`);
  if (!el) throw new Error(`Unable to find element with testid: ${id}`);
  return el as HTMLElement;
}

function renderCreateScreen() {
  const navigation = { goBack: vi.fn(), setOptions: vi.fn() } as unknown as EditExpenseScreenProps['navigation'];
  const route = {
    params: { groupId: 1, groupName: 'Roommates', groupCurrencyCode: 'GBP' },
  } as unknown as EditExpenseScreenProps['route'];
  return render(<EditExpenseScreen navigation={navigation} route={route} />);
}

describe('issue #45: picker-modal content stays above the system nav bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCategories).mockResolvedValue(mockCategories);
    vi.mocked(getLabels).mockResolvedValue([]);
    vi.mocked(getGroup).mockResolvedValue({ id: 1, members: mockGroupMembers } as unknown as Awaited<ReturnType<typeof getGroup>>);
    vi.mocked(suggestExpenses).mockResolvedValue({ matches: [], categorySuggestion: null });
  });

  it('wraps the "Who Paid?" picker content in a SafeAreaView so the last member row is never behind the nav bar', async () => {
    const { container } = renderCreateScreen();
    await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

    fireEvent.click(getByTestId(container, 'edit-expense-paid-by-picker-button'));

    const lastMemberOption = getByTestId(container, 'edit-expense-paid-by-option-2'); // "Nav"
    const doneButton = getByTestId(container, 'edit-expense-paid-by-modal-close-button');

    expectClearsNavBar(lastMemberOption.closest('[data-rn-safe-area-view]'), lastMemberOption, doneButton);
  });

  it('wraps the "Split Type" picker content in a SafeAreaView so its last option and Done button are reachable', async () => {
    const { container } = renderCreateScreen();
    await waitFor(() => expect(screen.getByText('Other')).toBeTruthy());

    fireEvent.click(getByTestId(container, 'edit-expense-split-type-picker-button'));

    const percentageOption = getByTestId(container, 'edit-expense-split-type-option-PERCENTAGE'); // last option in the list
    const doneButton = getByTestId(container, 'edit-expense-split-type-modal-close-button');

    expectClearsNavBar(percentageOption.closest('[data-rn-safe-area-view]'), percentageOption, doneButton);
  });
});

// ---------------------------------------------------------------------
// Part 2: TypeAheadDropdown -- the shared Category/Label picker used by
// both EditExpenseScreen and CreateExpenseScreen, identified by the
// whole-frontend grep for the same pickerModal-shaped Modal pattern
// (task item 3).
// ---------------------------------------------------------------------

describe('issue #45: TypeAheadDropdown content stays above the system nav bar', () => {
  it('wraps its picker content in a SafeAreaView so the last item and filter input remain reachable', () => {
    const { container } = render(
      <TypeAheadDropdown
        visible
        title="Select Category"
        items={[
          { id: 1, name: 'Food' },
          { id: 2, name: 'Travel' },
        ]}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
        onClose={vi.fn()}
        testIDPrefix="cat"
      />
    );

    const lastItem = getByTestId(container, 'cat-option-2');

    expectClearsNavBar(lastItem.closest('[data-rn-safe-area-view]'), lastItem);
  });
});

// ---------------------------------------------------------------------
// Part 3: screen-level instances of the SAME root cause (no SafeAreaView
// anywhere on the screen, so the last row/button can render under the
// nav bar) reported by a second user screenshot against HomeScreen.
// These screens need heavier navigation/data mocking to fully render, so
// this is a source-level structural guard: it fails if a future edit
// reverts the screen's root element back to a plain View/ScrollView
// without a SafeAreaView, which is exactly the regression that caused
// the bug on HomeScreen in the first place.
// ---------------------------------------------------------------------

function readScreenSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../screens', relativePath), 'utf8');
}

describe('issue #45: screen-level root containers apply safe-area insets', () => {
  it.each([
    ['HomeScreen.tsx', 'home-screen'],
    ['ExpenseListScreen.tsx', 'expense-list-screen'],
  ])('%s wraps its root testID container in a SafeAreaView, not a plain View', (file) => {
    const src = readScreenSource(file);
    expect(src).toMatch(/import\s*\{\s*SafeAreaView\s*\}\s*from\s*'react-native-safe-area-context'/);
    // The root element that used to be `<View style={styles.container} testID="...">`
    // must now be a SafeAreaView, and its matching close tag must be present.
    expect(src).toMatch(/<SafeAreaView[\s\S]{0,40}style=\{styles\.container\}/);
    expect(src).toMatch(/<\/SafeAreaView>/);
  });

  it('SettlementScreen wraps its root container in a SafeAreaView, not a plain View', () => {
    const src = readScreenSource('SettlementScreen.tsx');
    expect(src).toMatch(/import\s*\{\s*SafeAreaView\s*\}\s*from\s*'react-native-safe-area-context'/);
    expect(src).toMatch(/<SafeAreaView style=\{styles\.container\}>/);
    expect(src).toMatch(/<\/SafeAreaView>/);
  });

  it('CreateExpenseScreen wraps its root container in a SafeAreaView, matching the sibling EditExpenseScreen pattern', () => {
    const src = readScreenSource('CreateExpenseScreen.tsx');
    expect(src).toMatch(/import\s*\{\s*SafeAreaView\s*\}\s*from\s*'react-native-safe-area-context'/);
    expect(src).toMatch(/<SafeAreaView style=\{styles\.container\}>/);
    expect(src).toMatch(/<\/SafeAreaView>\s*\n\s*\);/);
  });
});
