/**
 * EditGroupModal Tests
 *
 * GitHub issue #3: EditGroupModal never showed existing group members
 * directly -- they were only visible as a side effect of opening
 * AddMemberModal's "add by email" form. These tests verify the modal now
 * renders the group's current members directly.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert } from 'react-native';
import EditGroupModal from '../EditGroupModal';
import type { Group } from '../../services/groupService';
import type { Currency } from '../../services/currencyService';
import type { Theme } from '../../services/themeService';

const mockUpdateGroup = vi.fn();
const mockDeleteGroup = vi.fn();
const mockGetCurrencies = vi.fn();
const mockGetThemes = vi.fn();
const mockCreateTheme = vi.fn();

vi.mock('../../services/groupService', () => ({
  updateGroup: (...args: unknown[]) => mockUpdateGroup(...args),
  deleteGroup: (...args: unknown[]) => mockDeleteGroup(...args),
}));

vi.mock('../../services/currencyService', () => ({
  getCurrencies: () => mockGetCurrencies(),
}));

vi.mock('../../services/themeService', () => ({
  getThemes: () => mockGetThemes(),
  createTheme: (...args: unknown[]) => mockCreateTheme(...args),
}));

const baseCurrencies: Currency[] = [
  { id: 1, code: 'USD', label: 'US Dollar' },
  { id: 2, code: 'GBP', label: 'British Pound' },
] as Currency[];

const baseThemes: Theme[] = [
  { id: 1, name: 'Monthly Expense', userId: null, isActive: true },
  { id: 2, name: 'Paris Trip', userId: 1, isActive: true },
];

const baseGroup: Group = {
  id: 1,
  name: 'Roommates',
  description: 'Shared flat expenses',
  currency: { id: 1, code: 'USD', label: 'US Dollar' },
  members: [
    { id: 1, name: 'Alice', email: 'alice@test.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' },
  ],
} as Group;

describe('EditGroupModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const onDeleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrencies.mockResolvedValue(baseCurrencies);
    mockGetThemes.mockResolvedValue(baseThemes);
  });

  // RN's testID renders as a lowercase `testid` attribute on web, not the
  // `data-testid` @testing-library/react's getByTestId expects.
  function getByTestId(container: HTMLElement, id: string): HTMLElement {
    const el = container.querySelector(`[testid="${id}"]`);
    if (!el) throw new Error(`Unable to find element with testid: ${id}`);
    return el as HTMLElement;
  }

  it('renders the current group members directly, without opening AddMemberModal', () => {
    render(
      <EditGroupModal visible group={baseGroup} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
    );

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('shows the member count in the section heading', () => {
    render(
      <EditGroupModal visible group={baseGroup} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
    );

    expect(screen.getByText(/Members \(2\)/)).toBeTruthy();
  });

  it('renders no member rows when the group has no members', () => {
    const emptyGroup: Group = { ...baseGroup, members: [] };

    render(
      <EditGroupModal visible group={emptyGroup} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
    );

    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.getByText(/Members \(0\)/)).toBeTruthy();
  });

  it('renders nothing member-related when group is null', () => {
    render(
      <EditGroupModal visible group={null} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
    );

    expect(screen.queryByText('Alice')).toBeNull();
  });

  describe('Theme (U8, R1)', () => {
    it('selecting an existing theme from the dropdown persists themeId on group save (AE1)', async () => {
      const user = userEvent.setup();
      mockUpdateGroup.mockResolvedValue({ ...baseGroup, theme: baseThemes[0] });
      const { container } = render(
        <EditGroupModal visible group={baseGroup} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
      );

      await waitFor(() => expect(mockGetThemes).toHaveBeenCalled());
      await user.click(getByTestId(container, 'edit-group-theme-picker-button'));
      await user.click(getByTestId(container, 'edit-group-theme-option-1'));
      await user.click(getByTestId(container, 'edit-group-save-button'));

      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith(
          baseGroup.id,
          expect.objectContaining({ themeId: 1 })
        );
      });
    });

    it('using "Add new" on the theme dropdown creates it via createTheme, then selects it without reopening the dropdown', async () => {
      const user = userEvent.setup();
      const created: Theme = { id: 3, name: 'Ski Trip', userId: 1, isActive: true };
      mockCreateTheme.mockResolvedValue(created);
      const { container } = render(
        <EditGroupModal visible group={baseGroup} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
      );

      await waitFor(() => expect(mockGetThemes).toHaveBeenCalled());
      await user.click(getByTestId(container, 'edit-group-theme-picker-button'));
      await user.click(getByTestId(container, 'edit-group-theme-add-new-button'));
      await user.type(getByTestId(container, 'edit-group-theme-create-input'), 'Ski Trip');
      await user.click(getByTestId(container, 'edit-group-theme-create-submit-button'));

      await waitFor(() => {
        expect(mockCreateTheme).toHaveBeenCalledWith('Ski Trip');
        expect(screen.getByText('Ski Trip')).toBeTruthy();
      });
    });

    it('shows a disabled theme the group already references by name, even though it is not in the selectable dropdown list (AE5)', () => {
      // getThemes only returns active themes -- a disabled theme the group
      // already references never appears in `themes`, so this exercises the
      // group.theme?.name fallback.
      mockGetThemes.mockResolvedValue([]);
      const groupWithDisabledTheme: Group = {
        ...baseGroup,
        theme: { id: 9, name: 'Old Roadtrip' },
      };

      render(
        <EditGroupModal visible group={groupWithDisabledTheme} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
      );

      expect(screen.getByText('Old Roadtrip')).toBeTruthy();
    });

    it('shows the group\'s already-set theme correctly on first render, not reset once the dropdown\'s own data finishes loading (hydration regression guard)', async () => {
      const groupWithTheme: Group = { ...baseGroup, theme: baseThemes[1] };

      render(
        <EditGroupModal visible group={groupWithTheme} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
      );

      // Theme is visible immediately, from group.theme -- before getThemes()
      // (an async fetch) has resolved at all.
      expect(screen.getByText('Paris Trip')).toBeTruthy();

      await waitFor(() => expect(mockGetThemes).toHaveBeenCalled());

      // Still showing the same value after the themes list finishes loading.
      expect(screen.getByText('Paris Trip')).toBeTruthy();
    });
  });

  describe('Delete Group (issue #47)', () => {
    // The RN mock in src/tests/setup.tsx sets Platform.OS to 'ios', so
    // confirmThenProceed's native branch (Alert.alert) runs, not the web
    // window.confirm branch. Alert is mocked as a bare vi.fn(), so we
    // capture its button-config array and invoke the relevant button's
    // onPress ourselves, mirroring what a real Alert would do.
    function pressAlertButton(label: string) {
      const lastCall = (Alert.alert as ReturnType<typeof vi.fn>).mock.calls.at(-1);
      const buttons = lastCall?.[2] as Array<{ text: string; onPress?: () => void }>;
      const button = buttons?.find((b) => b.text === label);
      button?.onPress?.();
    }

    it('warns about existing expenses before deleting a group that has them', async () => {
      mockDeleteGroup.mockResolvedValue({ ...baseGroup, isActive: false });
      const groupWithExpenses: Group = {
        ...baseGroup,
        _count: { expenses: 3, members: 2 },
      } as Group;
      const { container } = render(
        <EditGroupModal visible group={groupWithExpenses} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
      );

      fireEvent.click(getByTestId(container, 'edit-group-delete-button'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Group',
        expect.stringContaining('This group has 3 expenses'),
        expect.anything()
      );

      pressAlertButton('Delete');

      await waitFor(() => {
        expect(mockDeleteGroup).toHaveBeenCalledWith(baseGroup.id);
        expect(onDeleted).toHaveBeenCalledWith(baseGroup.id);
      });
    });

    it('does not mention expenses when the group has none', async () => {
      mockDeleteGroup.mockResolvedValue({ ...baseGroup, isActive: false });
      const emptyGroup: Group = { ...baseGroup, _count: { expenses: 0, members: 2 } } as Group;
      const { container } = render(
        <EditGroupModal visible group={emptyGroup} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
      );

      fireEvent.click(getByTestId(container, 'edit-group-delete-button'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Group',
        expect.not.stringContaining('expense'),
        expect.anything()
      );

      pressAlertButton('Delete');

      await waitFor(() => {
        expect(mockDeleteGroup).toHaveBeenCalledWith(baseGroup.id);
      });
    });

    it('does not call deleteGroup when the confirmation is cancelled', () => {
      const { container } = render(
        <EditGroupModal visible group={baseGroup} onClose={onClose} onSuccess={onSuccess} onDeleted={onDeleted} />
      );

      fireEvent.click(getByTestId(container, 'edit-group-delete-button'));
      pressAlertButton('Cancel');

      expect(mockDeleteGroup).not.toHaveBeenCalled();
      expect(onDeleted).not.toHaveBeenCalled();
    });
  });
});
