/**
 * ManageLabelsScreen Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Platform, Alert } from 'react-native';
import ManageLabelsScreen from '../ManageLabelsScreen';
import type { LabelTotal } from '../../services/labelService';

const mockGetLabelTotals = vi.fn();
const mockDisableLabel = vi.fn();

vi.mock('../../services/labelService', () => ({
  getLabelTotals: (...args: unknown[]) => mockGetLabelTotals(...args),
  disableLabel: (...args: unknown[]) => mockDisableLabel(...args),
}));

// RN's testID renders as a lowercase `testid` attribute on web, not the
// `data-testid` @testing-library/react's getByTestId expects.
function getByTestId(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(`[testid="${id}"]`);
  if (!el) throw new Error(`Unable to find element with testid: ${id}`);
  return el as HTMLElement;
}

function queryByTestId(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[testid="${id}"]`) as HTMLElement | null;
}

const baseLabels: LabelTotal[] = [
  { id: 1, name: 'Liverpool', userId: 1, isActive: true, total: 245.5 },
  { id: 2, name: 'Work Trips', userId: 1, isActive: true, total: 0 },
];

function renderScreen() {
  const navigation = { goBack: vi.fn(), setOptions: vi.fn(), navigate: vi.fn() } as any;
  return render(<ManageLabelsScreen navigation={navigation} route={{ params: undefined } as any} />);
}

describe('ManageLabelsScreen', () => {
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

  it('renders each label with its correct total (AE4)', async () => {
    mockGetLabelTotals.mockResolvedValue(baseLabels);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Liverpool')).toBeTruthy());

    expect(screen.getByText('245.50')).toBeTruthy();
    expect(screen.getByText('Work Trips')).toBeTruthy();
  });

  it('renders a label with a 0 total, not silently hidden', async () => {
    mockGetLabelTotals.mockResolvedValue(baseLabels);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Work Trips')).toBeTruthy());

    expect(screen.getByText('0.00')).toBeTruthy();
  });

  it('confirming the disable prompt calls disableLabel and removes the row from the list', async () => {
    const user = userEvent.setup();
    mockGetLabelTotals.mockResolvedValue(baseLabels);
    mockDisableLabel.mockResolvedValue({ id: 1, name: 'Liverpool', isActive: false });
    confirmSpy.mockReturnValue(true);
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Liverpool')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-labels-disable-1'));

    await waitFor(() => {
      expect(mockDisableLabel).toHaveBeenCalledWith(1);
      expect(screen.queryByText('Liverpool')).toBeNull();
    });
  });

  it('dismissing the disable confirmation leaves the label untouched -- disableLabel is never called', async () => {
    const user = userEvent.setup();
    mockGetLabelTotals.mockResolvedValue(baseLabels);
    confirmSpy.mockReturnValue(false);
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Liverpool')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-labels-disable-1'));

    expect(mockDisableLabel).not.toHaveBeenCalled();
    expect(screen.getByText('Liverpool')).toBeTruthy();
  });

  it('surfaces a visible error when disableLabel fails, not just a silent console log (regression: peer-session review found this only logger.error\'d)', async () => {
    const user = userEvent.setup();
    mockGetLabelTotals.mockResolvedValue(baseLabels);
    mockDisableLabel.mockRejectedValue(new Error('Network error'));
    confirmSpy.mockReturnValue(true);
    const mockAlert = Alert.alert as ReturnType<typeof vi.fn>;
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Liverpool')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-labels-disable-1'));

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Error', 'Network error'));
    // The row stays -- disabling genuinely failed, so it must not disappear.
    expect(screen.getByText('Liverpool')).toBeTruthy();
  });

  it('shows the ErrorState component, not a blank screen, when the totals fetch fails', async () => {
    mockGetLabelTotals.mockRejectedValue(new Error('Network error'));
    const { container } = renderScreen();

    await waitFor(() => expect(getByTestId(container, 'error-state')).toBeTruthy());
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('shows an empty state, not an error, when there are zero labels', async () => {
    mockGetLabelTotals.mockResolvedValue([]);
    const { container } = renderScreen();

    await waitFor(() => expect(getByTestId(container, 'manage-labels-empty-state')).toBeTruthy());
    expect(queryByTestId(container, 'error-state')).toBeNull();
  });
});
