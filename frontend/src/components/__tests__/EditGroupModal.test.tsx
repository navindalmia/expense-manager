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
import { render, screen } from '@testing-library/react';
import EditGroupModal from '../EditGroupModal';
import type { Group } from '../../services/groupService';
import type { Currency } from '../../services/currencyService';

const mockUpdateGroup = vi.fn();
const mockGetCurrencies = vi.fn();

vi.mock('../../services/groupService', () => ({
  updateGroup: (...args: unknown[]) => mockUpdateGroup(...args),
}));

vi.mock('../../services/currencyService', () => ({
  getCurrencies: () => mockGetCurrencies(),
}));

const baseCurrencies: Currency[] = [
  { id: 1, code: 'USD', label: 'US Dollar' },
  { id: 2, code: 'GBP', label: 'British Pound' },
] as Currency[];

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

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrencies.mockResolvedValue(baseCurrencies);
  });

  it('renders the current group members directly, without opening AddMemberModal', () => {
    render(
      <EditGroupModal visible group={baseGroup} onClose={onClose} onSuccess={onSuccess} />
    );

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('shows the member count in the section heading', () => {
    render(
      <EditGroupModal visible group={baseGroup} onClose={onClose} onSuccess={onSuccess} />
    );

    expect(screen.getByText(/Members \(2\)/)).toBeTruthy();
  });

  it('renders no member rows when the group has no members', () => {
    const emptyGroup: Group = { ...baseGroup, members: [] };

    render(
      <EditGroupModal visible group={emptyGroup} onClose={onClose} onSuccess={onSuccess} />
    );

    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.getByText(/Members \(0\)/)).toBeTruthy();
  });

  it('renders nothing member-related when group is null', () => {
    render(
      <EditGroupModal visible group={null} onClose={onClose} onSuccess={onSuccess} />
    );

    expect(screen.queryByText('Alice')).toBeNull();
  });
});
