/**
 * Regression test for issue #143 (second half).
 *
 * Patching the PATCH reply by hand is only an optimistic update. Home must also
 * reload its groups from the server after an Edit Group success AND whenever the
 * Edit Group modal closes (a Modal rendered by Home does not trigger focus, and
 * AddMemberModal skips onMemberAdded when closed during its success window).
 * Refreshes are silent (no spinner, list kept) and stale responses are ignored.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import type { Group } from '../../services/groupService';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockGet, modalProps } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  modalProps: { current: null as null | { onClose: () => void; onSuccess: (g: unknown) => void } },
}));

const authValue = vi.hoisted(() => ({ logout: () => Promise.resolve(), user: { id: 1 } }));
vi.mock('../../api/http', () => ({ http: { get: mockGet } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => authValue }));
vi.mock('@react-navigation/native', () => ({ useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]) }));
vi.mock('../../components/StagingBanner', () => ({ default: () => null }));
vi.mock('../../components/HomeMenu', () => ({ default: () => null }));
vi.mock('../../components/LoadingState', () => ({ default: () => <div data-testid="loading-state" /> }));
vi.mock('../../components/ErrorState', () => ({ default: () => <div data-testid="error-state" /> }));
vi.mock('../../components/EditGroupModal', () => ({
  default: (props: { onClose: () => void; onSuccess: (g: unknown) => void }) => {
    modalProps.current = props;
    return null;
  },
}));
vi.mock('../../utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import HomeScreen from '../../screens/HomeScreen';

const mk = (members: number): Group =>
  ({
    id: 1,
    name: 'Trip',
    currency: { id: 1, code: 'USD', label: 'US' },
    totalAmount: 10,
    userPersonalTotal: 5,
    members: [],
    _count: { expenses: 4, members },
    createdAt: '2026-01-01',
  }) as unknown as Group;
const reply = (members: number) => ({ data: { data: [mk(members)] } });
const navigation = { navigate: vi.fn(), setOptions: vi.fn() };
const renderHome = () => render(<HomeScreen {...({ navigation } as unknown as React.ComponentProps<typeof HomeScreen>)} />);
const count = (n: number) => `4 expenses • ${n} members`;

describe('issue #143: Home reloads groups after Edit Group changes', () => {
  beforeEach(() => {
    cleanup();
    mockGet.mockReset();
    modalProps.current = null;
  });

  it('should refetch from the server after onSuccess and show the server member count', async () => {
    mockGet.mockResolvedValueOnce(reply(2));
    renderHome();
    await screen.findByText(count(2));
    mockGet.mockResolvedValueOnce(reply(3));
    // PATCH reply lacks _count and members, so only a refetch can yield 3
    await act(async () => modalProps.current!.onSuccess({ id: 1, name: 'Trip' }));
    await screen.findByText(count(3));
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('should refetch when the modal closes without onSuccess (quick close)', async () => {
    mockGet.mockResolvedValueOnce(reply(2));
    renderHome();
    await screen.findByText(count(2));
    mockGet.mockResolvedValueOnce(reply(3));
    await act(async () => modalProps.current!.onClose());
    await screen.findByText(count(3));
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('should not show the loading spinner or blank the list while refreshing', async () => {
    mockGet.mockResolvedValueOnce(reply(2));
    renderHome();
    await screen.findByText(count(2));
    let resolve!: (v: unknown) => void;
    mockGet.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    act(() => modalProps.current!.onClose());
    expect(screen.queryByTestId('loading-state')).toBeNull();
    expect(screen.getByText(count(2))).toBeTruthy();
    await act(async () => resolve(reply(3)));
    await screen.findByText(count(3));
  });

  it('should ignore a stale slower response that arrives after a newer one', async () => {
    mockGet.mockResolvedValueOnce(reply(2));
    renderHome();
    await screen.findByText(count(2));
    let resolveOld!: (v: unknown) => void;
    mockGet.mockReturnValueOnce(new Promise((r) => (resolveOld = r)));
    mockGet.mockResolvedValueOnce(reply(4));
    act(() => modalProps.current!.onClose());
    await act(async () => modalProps.current!.onClose());
    await screen.findByText(count(4));
    await act(async () => resolveOld(reply(3)));
    expect(screen.getByText(count(4))).toBeTruthy();
    expect(screen.queryByText(count(3))).toBeNull();
  });

  it('should keep the existing list when a refresh fails', async () => {
    mockGet.mockResolvedValueOnce(reply(2));
    renderHome();
    await screen.findByText(count(2));
    mockGet.mockRejectedValueOnce(new Error('network'));
    await act(async () => modalProps.current!.onClose());
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(screen.getByText(count(2))).toBeTruthy();
    expect(screen.queryByTestId('error-state')).toBeNull();
  });
});
