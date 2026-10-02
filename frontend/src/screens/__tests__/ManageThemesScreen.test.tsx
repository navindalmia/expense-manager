/**
 * ManageThemesScreen Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Platform, Alert } from 'react-native';
import ManageThemesScreen from '../ManageThemesScreen';
import type { ThemeUsage } from '../../services/themeService';
import type { ManageThemesScreenProps } from '../../types/navigation';

const mockGetThemeUsage = vi.fn();
const mockDisableTheme = vi.fn();
const mockRenameTheme = vi.fn();

vi.mock('../../services/themeService', () => ({
  getThemeUsage: (...args: unknown[]) => mockGetThemeUsage(...args),
  disableTheme: (...args: unknown[]) => mockDisableTheme(...args),
  renameTheme: (...args: unknown[]) => mockRenameTheme(...args),
}));

// RN's testID renders as a lowercase `testid` attribute on web.
function getByTestId(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(`[testid="${id}"]`);
  if (!el) throw new Error(`Unable to find element with testid: ${id}`);
  return el as HTMLElement;
}

function queryByTestId(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[testid="${id}"]`) as HTMLElement | null;
}

const baseThemes: ThemeUsage[] = [
  { id: 1, name: 'Holiday', userId: 1, isActive: true, groupCount: 2, expenseCount: 5 },
  { id: 2, name: 'Monthly Expense', userId: 1, isActive: true, groupCount: 1, expenseCount: 0 },
  { id: 3, name: 'System Theme', userId: null, isActive: true, groupCount: 0, expenseCount: 0 },
];

function renderScreen() {
  const props = {
    navigation: { goBack: vi.fn(), setOptions: vi.fn(), navigate: vi.fn() },
    route: { params: undefined },
  } as unknown as ManageThemesScreenProps;
  return render(<ManageThemesScreen {...props} />);
}

describe('ManageThemesScreen', () => {
  const originalOS = Platform.OS;
  let confirmSpy: ReturnType<typeof vi.fn<(message?: string) => boolean>>;

  beforeEach(() => {
    vi.clearAllMocks();
    Platform.OS = 'web';
    confirmSpy = vi.spyOn(window, 'confirm') as unknown as ReturnType<typeof vi.fn<(message?: string) => boolean>>;
  });

  afterEach(() => {
    Platform.OS = originalOS;
    confirmSpy.mockRestore();
  });

  it('lists active themes with their usage counts', async () => {
    mockGetThemeUsage.mockResolvedValue(baseThemes);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());

    expect(screen.getByText('2 groups, 5 expenses')).toBeTruthy();
    expect(screen.getByText('1 group, 0 expenses')).toBeTruthy();
  });

  it('does not offer Edit/Disable for a system theme the user does not own', async () => {
    mockGetThemeUsage.mockResolvedValue(baseThemes);
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('System Theme')).toBeTruthy());

    expect(queryByTestId(container, 'manage-themes-disable-3')).toBeNull();
    expect(queryByTestId(container, 'manage-themes-edit-3')).toBeNull();
    expect(getByTestId(container, 'manage-themes-disable-1')).toBeTruthy();
  });

  it('confirming Disable calls disableTheme and removes the row', async () => {
    const user = userEvent.setup();
    mockGetThemeUsage.mockResolvedValue(baseThemes);
    mockDisableTheme.mockResolvedValue({ id: 1, isActive: false });
    confirmSpy.mockReturnValue(true);
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-themes-disable-1'));

    await waitFor(() => {
      expect(mockDisableTheme).toHaveBeenCalledWith(1);
      expect(screen.queryByText('Holiday')).toBeNull();
    });
  });

  it('dismissing the Disable confirmation never calls disableTheme', async () => {
    const user = userEvent.setup();
    mockGetThemeUsage.mockResolvedValue(baseThemes);
    confirmSpy.mockReturnValue(false);
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-themes-disable-1'));

    expect(mockDisableTheme).not.toHaveBeenCalled();
    expect(screen.getByText('Holiday')).toBeTruthy();
  });

  it('surfaces an Alert and keeps the row when disableTheme fails', async () => {
    const user = userEvent.setup();
    mockGetThemeUsage.mockResolvedValue(baseThemes);
    mockDisableTheme.mockRejectedValue(new Error('Network error'));
    confirmSpy.mockReturnValue(true);
    const mockAlert = Alert.alert as ReturnType<typeof vi.fn>;
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-themes-disable-1'));

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Error', 'Network error'));
    expect(screen.getByText('Holiday')).toBeTruthy();
  });

  it('renames a theme via the edit modal', async () => {
    const user = userEvent.setup();
    mockGetThemeUsage.mockResolvedValue(baseThemes);
    mockRenameTheme.mockResolvedValue({ id: 1, name: 'Trips', userId: 1, isActive: true });
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Holiday')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-themes-edit-1'));
    fireEvent.change(getByTestId(container, 'manage-themes-rename-input'), { target: { value: 'Trips' } });
    await user.click(getByTestId(container, 'manage-themes-rename-save-button'));

    await waitFor(() => expect(mockRenameTheme).toHaveBeenCalledWith(1, 'Trips'));
    await waitFor(() => expect(screen.getByText('Trips')).toBeTruthy());
  });

  it('shows the empty state when there are no themes', async () => {
    mockGetThemeUsage.mockResolvedValue([]);
    const { container } = renderScreen();

    await waitFor(() => expect(getByTestId(container, 'manage-themes-empty-state')).toBeTruthy());
    expect(queryByTestId(container, 'error-state')).toBeNull();
  });

  it('shows the ErrorState when loading fails', async () => {
    mockGetThemeUsage.mockRejectedValue(new Error('Network error'));
    const { container } = renderScreen();

    await waitFor(() => expect(getByTestId(container, 'error-state')).toBeTruthy());
    expect(screen.getByText('Network error')).toBeTruthy();
  });
});
