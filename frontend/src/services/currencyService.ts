/**
 * Currency Service
 * 
 * Service layer for fetching available currencies from backend.
 * Abstracts HTTP calls to backend /api/currencies endpoint.
 */

import { http } from '../api/http';

/**
 * Currency entity from backend.
 * Represents a supported currency with ISO code.
 */
export interface Currency {
  id: number;
  code: string;
  label: string;
}

/**
 * Fetch all available currencies from backend.
 * 
 * GET /api/currencies
 * 
 * Returns array of currency objects supported by the application.
 * Used by expense creation/editing forms for currency selection.
 * 
 * Returns: Currency[]
 * Throws: HTTP error if backend is unavailable
 * 
 * Example:
 * const currencies = await getCurrencies();
 * // [
 * //   { id: 1, code: 'GBP', label: 'British Pound' },
 * //   { id: 2, code: 'USD', label: 'US Dollar' },
 * // ]
 */
export async function getCurrencies(): Promise<Currency[]> {
  const response = await http.get<{ statusCode: number; data: Currency[] }>(
    '/currencies'
  );
  return response.data.data;
}

