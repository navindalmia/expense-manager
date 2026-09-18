/**
 * useCurrencies Tests
 *
 * Extracted from CreateGroupScreen/EditGroupModal during the #50/#51 fix's
 * code review, which flagged two duplicate copies of this fetch effect and
 * a silent-failure gap (a failed GET /currencies left the picker empty
 * with no user-visible indication anything went wrong). This suite covers
 * the success and failure paths directly on the shared hook.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useCurrencies } from '../useCurrencies';
import { getCurrencies } from '../../services/currencyService';

vi.mock('../../services/currencyService', () => ({
  getCurrencies: vi.fn(),
}));

describe('useCurrencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and returns the currency list on success, with no error', async () => {
    const mockCurrencies = [{ id: 1, code: 'GBP', label: 'British Pound' }];
    (getCurrencies as ReturnType<typeof vi.fn>).mockResolvedValue(mockCurrencies);

    const { result } = renderHook(() => useCurrencies());

    expect(result.current.loadingCurrencies).toBe(true);

    await waitFor(() => {
      expect(result.current.loadingCurrencies).toBe(false);
    });

    expect(result.current.currencies).toEqual(mockCurrencies);
    expect(result.current.currenciesError).toBeNull();
  });

  it('surfaces a user-facing error when the fetch fails, instead of leaving it silent', async () => {
    (getCurrencies as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCurrencies());

    await waitFor(() => {
      expect(result.current.loadingCurrencies).toBe(false);
    });

    expect(result.current.currencies).toEqual([]);
    expect(result.current.currenciesError).toBe('Failed to load currencies. Please try again.');
  });
});
