/**
 * Issue #90 regression pack: Disable no longer removes the row. It stays
 * listed (tagged Disabled) with an Enable button, and Enable restores it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManageLabelsScreen from '../../screens/ManageLabelsScreen';
import ManageThemesScreen from '../../screens/ManageThemesScreen';

const mockGet = vi.fn();
const mockPatch = vi.fn();
vi.mock('../../api/http', () => ({
  http: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) },
}));

const byTestId = (c: HTMLElement, id: string) => c.querySelector(`[testid="${id}"]`) as HTMLElement | null;
const nav = () => ({ goBack: vi.fn(), setOptions: vi.fn(), navigate: vi.fn() });

describe.each([
  ['labels', ManageLabelsScreen, 'Liverpool', { total: 5 }],
  ['themes', ManageThemesScreen, 'Holiday', { groupCount: 0, expenseCount: 0 }],
] as const)('issue 90: %s Disable keeps the row and Enable restores it', (kind, Screen, name, extra) => {
  const row = { id: 1, name, userId: 1, isActive: true, ...extra };
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: { statusCode: 200, data: [row] } });
  });

  it('should keep the disabled row listed with a Disabled tag and Enable button, then restore it', async () => {
    const user = userEvent.setup();
    const Rendered = Screen as unknown as React.ComponentType<{ navigation: unknown; route: unknown }>;
    const { container } = render(<Rendered navigation={nav()} route={{ params: undefined }} />);
    await waitFor(() => expect(screen.getByText(name)).toBeTruthy());

    mockPatch.mockResolvedValueOnce({ data: { statusCode: 200, data: { ...row, isActive: false } } });
    await user.click(byTestId(container, `manage-${kind}-disable-1`)!);
    await waitFor(() => expect(byTestId(container, `manage-${kind}-disabled-tag-1`)).not.toBeNull());
    expect(screen.getByText(name)).toBeTruthy();
    expect(byTestId(container, `manage-${kind}-enable-1`)).not.toBeNull();
    expect(byTestId(container, `manage-${kind}-disable-1`)).toBeNull();

    mockPatch.mockResolvedValueOnce({ data: { statusCode: 200, data: { ...row, isActive: true } } });
    await user.click(byTestId(container, `manage-${kind}-enable-1`)!);
    await waitFor(() => expect(byTestId(container, `manage-${kind}-disabled-tag-1`)).toBeNull());
    expect(byTestId(container, `manage-${kind}-disable-1`)).not.toBeNull();
  });
});
