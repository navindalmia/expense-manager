/**
 * useCurrencies
 *
 * Shared currency-loading hook, extracted from CreateGroupScreen and
 * EditGroupModal (issues #50/#51's fix originally duplicated this fetch
 * effect between the two -- exactly the "two independently-drifted
 * copies of the same list" failure mode those issues were filed for, now
 * for the fetch/error-handling logic instead of the currency array
 * itself). Fetches the backend-authoritative currency list once and
 * surfaces load failures instead of leaving the picker silently empty.
 */

import { useEffect, useState } from 'react';
import { getCurrencies, type Currency } from '../services/currencyService';
import { logger } from '../utils/logger';

export interface UseCurrenciesResult {
  currencies: Currency[];
  loadingCurrencies: boolean;
  currenciesError: string | null;
}

export function useCurrencies(): UseCurrenciesResult {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [currenciesError, setCurrenciesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCurrencies = async () => {
      try {
        setLoadingCurrencies(true);
        setCurrenciesError(null);
        const data = await getCurrencies();
        if (!cancelled) {
          setCurrencies(data);
        }
      } catch (error) {
        logger.error('Failed to load currencies', error);
        if (!cancelled) {
          setCurrenciesError('Failed to load currencies. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoadingCurrencies(false);
        }
      }
    };

    fetchCurrencies();

    return () => {
      cancelled = true;
    };
  }, []);

  return { currencies, loadingCurrencies, currenciesError };
}
