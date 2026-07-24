/**
 * AddMemberModal Tests
 *
 * ROADMAP.md flags this modal's destructive "Remove Member" confirmation
 * as a silent no-op on web (Alert.alert's multi-button array form has no
 * react-native-web implementation). The "characterizes the no-callback
 * case" test below proves that: clicking Remove invokes Alert.alert with
 * the expected title/message, but since nothing ever invokes the
 * button's onPress callback (exactly what happens on web), the actual
 * removal never runs -- this is the bug, reproduced at the unit level.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddMemberModal from '../AddMemberModal';
import type { Group } from '../../services/groupService';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockAlert = vi.fn();

vi.mock('react-native', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Modal: ({ children, visible }: any) => (visible ? <div>{children}</div> : null),
  ScrollView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TouchableOpacity: ({ children, onPress, disabled, ...props }: any) => (
    <button {...props} onClick={disabled ? undefined : onPress} disabled={disabled}>
      {children}
    </button>
  ),
  TextInput: ({ onChangeText, ...props }: any) => (
    <input {...props} onChange={(e) => onChangeText?.(e.target.value)} />
  ),
  ActivityIndicator: (props: any) => <div {...props}>loading</div>,
  FlatList: ({ data, renderItem, ...props }: any) => (
    <div {...props}>{data?.map((item: any, idx: number) => <div key={idx}>{renderItem({ item })}</div>)}</div>
  ),
  StyleSheet: { create: (styles: any) => styles },
  Alert: { alert: (...args: any[]) => mockAlert(...args) },
  Linking: { canOpenURL: vi.fn().mockResolvedValue(false), openURL: vi.fn() },
}));

const mockAddMemberByEmail = vi.fn();
const mockRemoveMemberFromGroup = vi.fn();

vi.mock('../../services/groupService', () => ({
  addMemberByEmail: (...args: any[]) => mockAddMemberByEmail(...args),
  removeMemberFromGroup: (...args: any[]) => mockRemoveMemberFromGroup(...args),
}));

const baseGroup: Group = {
  id: 1,
  name: 'Roommates',
  members: [
    { id: 1, name: 'Alice', email: 'alice@test.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' },
  ],
} as Group;

describe('AddMemberModal', () => {
  const onClose = vi.fn();
  const onMemberAdded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the current group members', () => {
    render(
      <AddMemberModal visible group={baseGroup} onClose={onClose} onMemberAdded={onMemberAdded} />
    );

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows a validation error and does not call the service for an invalid email', async () => {
    render(
      <AddMemberModal visible group={baseGroup} onClose={onClose} onMemberAdded={onMemberAdded} />
    );

    await userEvent.type(screen.getByPlaceholderText('member@example.com'), 'not-an-email');
    await userEvent.click(screen.getByText('Add'));

    expect(screen.getByText(/valid email address/)).toBeTruthy();
    expect(mockAddMemberByEmail).not.toHaveBeenCalled();
  });

  it('adds a member and calls onMemberAdded after the success delay', async () => {
    mockAddMemberByEmail.mockResolvedValue({
      data: { ...baseGroup, members: [...baseGroup.members, { id: 3, name: 'Carol', email: 'carol@test.com' }] },
    });

    render(
      <AddMemberModal visible group={baseGroup} onClose={onClose} onMemberAdded={onMemberAdded} />
    );

    await userEvent.type(screen.getByPlaceholderText('member@example.com'), 'carol@test.com');
    await userEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(screen.getByText(/added successfully/)).toBeTruthy());
    expect(mockAddMemberByEmail).toHaveBeenCalledWith(1, 'carol@test.com');

    // Real 1.5s success-display delay before onMemberAdded fires -- see
    // VerifyEmailScreen.test.tsx for why faking timers mid-test doesn't
    // work here (the timer is already scheduled against the real clock).
    await waitFor(() => expect(onMemberAdded).toHaveBeenCalled(), { timeout: 3000 });
  }, 10000);

  it('shows the service error message when adding a member fails', async () => {
    mockAddMemberByEmail.mockRejectedValue(new Error('User is already a member of this group'));

    render(
      <AddMemberModal visible group={baseGroup} onClose={onClose} onMemberAdded={onMemberAdded} />
    );

    await userEvent.type(screen.getByPlaceholderText('member@example.com'), 'bob@test.com');
    await userEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText(/already a member/)).toBeTruthy();
    });
    expect(onMemberAdded).not.toHaveBeenCalled();
  });

  it('characterizes the web no-op bug: Remove opens a confirm dialog but never removes the member unless its callback is invoked', async () => {
    render(
      <AddMemberModal visible group={baseGroup} onClose={onClose} onMemberAdded={onMemberAdded} />
    );

    await userEvent.click(screen.getAllByText('Remove')[0]!);

    expect(mockAlert).toHaveBeenCalledWith(
      'Remove Member',
      'Remove Alice from the group?',
      expect.any(Array)
    );
    // On web, Alert.alert's multi-button array has no confirm-dialog
    // implementation, so nothing ever invokes the "Remove" button's
    // onPress -- the service call never happens and the member is never
    // actually removed. This is the roadmap-flagged silent no-op.
    expect(mockRemoveMemberFromGroup).not.toHaveBeenCalled();
  });

  it('removes the member when the confirmation callback is explicitly invoked (native platforms)', async () => {
    mockRemoveMemberFromGroup.mockResolvedValue({ ...baseGroup, members: [baseGroup.members[0]!] });

    render(
      <AddMemberModal visible group={baseGroup} onClose={onClose} onMemberAdded={onMemberAdded} />
    );

    await userEvent.click(screen.getAllByText('Remove')[0]!);

    // Simulate what native Alert.alert does: invoke the destructive
    // button's onPress from the captured call.
    const buttons = mockAlert.mock.calls[0][2];
    const removeButton = buttons.find((b: any) => b.text === 'Remove');
    await removeButton.onPress();

    expect(mockRemoveMemberFromGroup).toHaveBeenCalledWith(1, 1);
    await waitFor(() => expect(onMemberAdded).toHaveBeenCalled());
  });
});
