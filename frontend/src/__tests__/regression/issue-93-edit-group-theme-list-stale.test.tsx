/**
 * Regression test for GitHub issue #93.
 *
 * HomeScreen keeps EditGroupModal mounted (hidden) for the whole session and
 * the modal fetched the theme list only once, on mount. A theme created
 * afterwards (e.g. on the expense screen) never appeared in the Edit group
 * theme picker until the app was restarted. The list must be re-fetched each
 * time the modal is opened.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import EditGroupModal from '../../components/EditGroupModal';
import type { Group } from '../../services/groupService';
import type { Theme } from '../../services/themeService';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetThemes = vi.fn();

vi.mock('../../services/groupService', () => ({ updateGroup: vi.fn() }));
vi.mock('../../services/currencyService', () => ({
  getCurrencies: vi.fn().mockResolvedValue([{ id: 1, code: 'GBP', label: 'GBP' }]),
}));
vi.mock('../../services/themeService', () => ({
  getThemes: () => mockGetThemes(),
  createTheme: vi.fn(),
}));

const group = {
  id: 1,
  name: 'G',
  description: '',
  currency: { id: 1, code: 'GBP', label: 'GBP' },
  members: [],
} as unknown as Group;

describe('issue #93: Edit group theme picker lists themes created after the modal mounted', () => {
  beforeEach(() => {
    cleanup();
    mockGetThemes.mockReset();
  });

  it('should show a theme created while the modal was hidden once the modal is opened', async () => {
    // Mutable "server state": what getThemes() returns at the moment it is called.
    let serverThemes: Theme[] = [{ id: 1, name: 'Monthly Expense', userId: null, isActive: true }];
    mockGetThemes.mockImplementation(() => Promise.resolve(serverThemes));
    const { rerender } = render(<EditGroupModal visible={false} group={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    // "Liverpool" is created elsewhere while the modal is hidden.
    serverThemes = [...serverThemes, { id: 20, name: 'Liverpool', userId: 1, isActive: true }];
    rerender(<EditGroupModal visible group={group} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(mockGetThemes).toHaveBeenCalled());
    fireEvent.click(document.querySelector('[testid="edit-group-theme-picker-button"]') as Element);
    await waitFor(() => expect(screen.getByText('Liverpool')).toBeTruthy());
  });

  it('should not fetch themes while hidden and should fetch once on every open', async () => {
    mockGetThemes.mockResolvedValue([]);
    const props = { group, onClose: vi.fn(), onSuccess: vi.fn() };
    const { rerender } = render(<EditGroupModal visible={false} {...props} />);
    expect(mockGetThemes).not.toHaveBeenCalled();

    rerender(<EditGroupModal visible {...props} />);
    await waitFor(() => expect(mockGetThemes).toHaveBeenCalledTimes(1));

    rerender(<EditGroupModal visible={false} {...props} />);
    expect(mockGetThemes).toHaveBeenCalledTimes(1);

    rerender(<EditGroupModal visible {...props} />);
    await waitFor(() => expect(mockGetThemes).toHaveBeenCalledTimes(2));
  });

  it('should ignore a late response from an earlier open when the modal was closed and reopened', async () => {
    let resolveFirst: (themes: Theme[]) => void = () => {};
    const stale: Theme[] = [{ id: 1, name: 'Stale Theme', userId: null, isActive: true }];
    const fresh: Theme[] = [{ id: 2, name: 'Fresh Theme', userId: 1, isActive: true }];
    mockGetThemes
      .mockImplementationOnce(() => new Promise<Theme[]>((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => Promise.resolve(fresh));
    const props = { group, onClose: vi.fn(), onSuccess: vi.fn() };
    const { rerender } = render(<EditGroupModal visible {...props} />);
    rerender(<EditGroupModal visible={false} {...props} />);
    rerender(<EditGroupModal visible {...props} />);
    await waitFor(() => expect(mockGetThemes).toHaveBeenCalledTimes(2));

    resolveFirst(stale); // the first open's response arrives after the second open's
    await Promise.resolve();
    fireEvent.click(document.querySelector('[testid="edit-group-theme-picker-button"]') as Element);

    await waitFor(() => expect(screen.getByText('Fresh Theme')).toBeTruthy());
    expect(screen.queryByText('Stale Theme')).toBeNull();
  });
});
