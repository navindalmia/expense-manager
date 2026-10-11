/**
 * ManageLabelsScreen Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Platform, Alert } from 'react-native';
import ManageLabelsScreen from '../ManageLabelsScreen';
import type { LabelTotal } from '../../services/labelService';

const mockGetLabelTotals = vi.fn();
const mockDisableLabel = vi.fn();
const mockEnableLabel = vi.fn();
const mockRenameLabel = vi.fn();

vi.mock('../../services/labelService', () => ({
  getLabelTotals: (...args: unknown[]) => mockGetLabelTotals(...args),
  disableLabel: (...args: unknown[]) => mockDisableLabel(...args),
  enableLabel: (...args: unknown[]) => mockEnableLabel(...args),
  renameLabel: (...args: unknown[]) => mockRenameLabel(...args),
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

const disabledRow: LabelTotal = { id: 4, name: 'Old One', userId: 1, isActive: false, total: 0 };
const baseItems = () => [...baseLabels, disabledRow];

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

  it('Disable acts immediately with no confirmation dialog and marks the row disabled', async () => {
    const user = userEvent.setup();
    mockGetLabelTotals.mockResolvedValue(baseItems());
    mockDisableLabel.mockResolvedValue({ id: 1, isActive: false });
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Liverpool')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-labels-disable-1'));

    await waitFor(() => expect(mockDisableLabel).toHaveBeenCalledWith(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(getByTestId(container, 'manage-labels-enable-1')).toBeTruthy());
    expect(getByTestId(container, 'manage-labels-disabled-tag-1')).toBeTruthy();
    expect(screen.getByText('Liverpool')).toBeTruthy();
  });

  it('requests the includeDisabled variant of the list', async () => {
    mockGetLabelTotals.mockResolvedValue(baseItems());
    renderScreen();

    await waitFor(() => expect(mockGetLabelTotals).toHaveBeenCalledWith({ includeDisabled: true }));
  });

  it('shows a disabled row with a Disabled tag, an Enable button and still an Edit button', async () => {
    mockGetLabelTotals.mockResolvedValue(baseItems());
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Old One')).toBeTruthy());

    expect(getByTestId(container, 'manage-labels-disabled-tag-4')).toBeTruthy();
    expect(getByTestId(container, 'manage-labels-enable-4')).toBeTruthy();
    expect(queryByTestId(container, 'manage-labels-disable-4')).toBeNull();
    expect(getByTestId(container, 'manage-labels-edit-4')).toBeTruthy();
  });

  it('tapping Enable calls enableLabel and the row becomes active again', async () => {
    const user = userEvent.setup();
    mockGetLabelTotals.mockResolvedValue(baseItems());
    mockEnableLabel.mockResolvedValue({ id: 4, isActive: true });
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Old One')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-labels-enable-4'));

    await waitFor(() => expect(mockEnableLabel).toHaveBeenCalledWith(4));
    await waitFor(() => expect(getByTestId(container, 'manage-labels-disable-4')).toBeTruthy());
    expect(queryByTestId(container, 'manage-labels-disabled-tag-4')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('surfaces an Alert and keeps the row disabled when enableLabel fails (e.g. name conflict)', async () => {
    const user = userEvent.setup();
    mockGetLabelTotals.mockResolvedValue(baseItems());
    mockEnableLabel.mockRejectedValue(new Error('Name already exists'));
    const mockAlert = Alert.alert as ReturnType<typeof vi.fn>;
    const { container } = renderScreen();

    await waitFor(() => expect(screen.getByText('Old One')).toBeTruthy());
    await user.click(getByTestId(container, 'manage-labels-enable-4'));

    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Error', 'Name already exists'));
    expect(getByTestId(container, 'manage-labels-enable-4')).toBeTruthy();
  });

  it('surfaces a visible error when disableLabel fails, not just a silent console log (regression: peer-session review found this only logger.error\'d)', async () => {
    const user = userEvent.setup();
    mockGetLabelTotals.mockResolvedValue(baseLabels);
    mockDisableLabel.mockRejectedValue(new Error('Network error'));
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
  describe('rename (R5)', () => {
    it('Edit opens a modal prefilled with the name; Save calls renameLabel and updates the row', async () => {
      const user = userEvent.setup();
      mockGetLabelTotals.mockResolvedValue(baseLabels);
      mockRenameLabel.mockResolvedValue({ id: 1, name: 'Anfield', userId: 1, isActive: true });
      const { container } = renderScreen();

      await waitFor(() => expect(screen.getByText('Liverpool')).toBeTruthy());
      await user.click(getByTestId(container, 'manage-labels-edit-1'));

      const input = getByTestId(container, 'manage-labels-rename-input') as HTMLInputElement;
      expect(input.value).toBe('Liverpool');
      fireEvent.change(input, { target: { value: 'Anfield' } });
      await user.click(getByTestId(container, 'manage-labels-rename-save-button'));

      await waitFor(() => expect(mockRenameLabel).toHaveBeenCalledWith(1, 'Anfield'));
      await waitFor(() => expect(screen.getByText('Anfield')).toBeTruthy());
      expect(screen.queryByText('Liverpool')).toBeNull();
    });

    it('shows an inline error and keeps the original name when the rename collides', async () => {
      const user = userEvent.setup();
      mockGetLabelTotals.mockResolvedValue(baseLabels);
      mockRenameLabel.mockRejectedValue(new Error('A label with this name already exists.'));
      const { container } = renderScreen();

      await waitFor(() => expect(screen.getByText('Liverpool')).toBeTruthy());
      await user.click(getByTestId(container, 'manage-labels-edit-1'));
      fireEvent.change(getByTestId(container, 'manage-labels-rename-input'), { target: { value: 'Work Trips' } });
      await user.click(getByTestId(container, 'manage-labels-rename-save-button'));

      await waitFor(() =>
        expect(getByTestId(container, 'manage-labels-rename-error').textContent).toBe('A label with this name already exists.')
      );
      expect(screen.getByText('Liverpool')).toBeTruthy();
    });

    it('Cancel closes the modal without calling renameLabel', async () => {
      const user = userEvent.setup();
      mockGetLabelTotals.mockResolvedValue(baseLabels);
      const { container } = renderScreen();

      await waitFor(() => expect(screen.getByText('Liverpool')).toBeTruthy());
      await user.click(getByTestId(container, 'manage-labels-edit-1'));
      fireEvent.change(getByTestId(container, 'manage-labels-rename-input'), { target: { value: 'Changed' } });
      await user.click(getByTestId(container, 'manage-labels-rename-cancel-button'));

      expect(mockRenameLabel).not.toHaveBeenCalled();
      expect(queryByTestId(container, 'manage-labels-rename-input')).toBeNull();
      expect(screen.getByText('Liverpool')).toBeTruthy();
    });
  });
});
