/**
 * CreateGroupScreen Tests
 *
 * GitHub issues #50/#51: the currency picker here used to be a hardcoded
 * array (['GBP','USD','EUR','INR','AUD','CAD','JPY','CNY']) that had
 * drifted from the backend's actual seeded currencies -- it included CNY
 * (never seeded, so selecting it and submitting failed with "Selected
 * currency is not available") and was missing several real currencies
 * (SGD, HKD, CHF, NZD, SEK) that EditGroupModal's live-fetched list did
 * show. This suite verifies the picker now fetches the same
 * backend-authoritative list EditGroupModal already used.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CreateGroupScreen from '../CreateGroupScreen';
import type { Currency } from '../../services/currencyService';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetCurrencies = vi.fn();
const mockGetThemes = vi.fn();

vi.mock('../../services/currencyService', () => ({
  getCurrencies: () => mockGetCurrencies(),
}));

vi.mock('../../services/themeService', () => ({
  getThemes: () => mockGetThemes(),
  createTheme: vi.fn(),
}));

vi.mock('../../api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// The real backend-seeded currency list (backend/prisma/seed.ts) -- notably
// does NOT include CNY, and includes several currencies the old hardcoded
// frontend array never listed.
const backendCurrencies: Currency[] = [
  { id: 1, code: 'GBP', label: 'British Pound' },
  { id: 2, code: 'USD', label: 'US Dollar' },
  { id: 3, code: 'EUR', label: 'Euro' },
  { id: 4, code: 'INR', label: 'Indian Rupee' },
  { id: 5, code: 'AUD', label: 'Australian Dollar' },
  { id: 6, code: 'CAD', label: 'Canadian Dollar' },
  { id: 7, code: 'JPY', label: 'Japanese Yen' },
  { id: 8, code: 'SGD', label: 'Singapore Dollar' },
  { id: 9, code: 'HKD', label: 'Hong Kong Dollar' },
  { id: 10, code: 'CHF', label: 'Swiss Franc' },
  { id: 11, code: 'NZD', label: 'New Zealand Dollar' },
  { id: 12, code: 'SEK', label: 'Swedish Krona' },
];

function renderScreen() {
  const navigation = { navigate: vi.fn(), goBack: vi.fn() } as any;
  const result = render(<CreateGroupScreen navigation={navigation} route={{} as any} />);

  const getByTestId = (id: string): HTMLElement | null =>
    result.container.querySelector(`[testid="${id}"]`);

  return { navigation, ...result, getByTestId };
}

describe('CreateGroupScreen currency picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrencies.mockResolvedValue(backendCurrencies);
    mockGetThemes.mockResolvedValue([]);
  });

  it('does not offer CNY, since the backend has no CNY currency seeded', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('currency-GBP')).toBeTruthy();
    });

    expect(getByTestId('currency-CNY')).toBeNull();
  });

  it('renders every currency the backend actually returns, matching EditGroupModal\'s list', async () => {
    const { getByTestId } = renderScreen();

    await waitFor(() => {
      expect(getByTestId('currency-SEK')).toBeTruthy();
    });

    for (const curr of backendCurrencies) {
      expect(getByTestId(`currency-${curr.code}`)).toBeTruthy();
    }
  });
});
