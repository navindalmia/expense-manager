import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { normalizeApiError } from '../error';

/**
 * normalizeApiError Tests
 *
 * Covers timeout (ECONNABORTED), network, and generic error normalization,
 * with emphasis on the timeout case surfaced by a slow-to-wake backend.
 */
describe('normalizeApiError', () => {
  it('should normalize an ECONNABORTED axios timeout into a retry-friendly message', () => {
    const axiosTimeoutError = {
      isAxiosError: true,
      code: 'ECONNABORTED',
      config: { url: '/expenses', method: 'get', timeout: 45000 },
    };

    const result = normalizeApiError(axiosTimeoutError);

    expect(result).toEqual({
      message: 'Request timed out. Please try again.',
      code: 'timeout',
    });
  });

  it('should normalize a network error with no response', () => {
    const axiosNetworkError = {
      isAxiosError: true,
      message: 'Network Error',
      config: { url: '/expenses', method: 'get' },
    };

    const result = normalizeApiError(axiosNetworkError);

    expect(result).toEqual({
      message: 'Network error. Check your connection.',
      code: 'network_error',
    });
  });

  it('should extract the backend message when a response payload is present', () => {
    const axiosResponseError = {
      isAxiosError: true,
      response: {
        status: 401,
        data: { message: 'Invalid credentials', error: 'AUTH_INVALID' },
      },
      config: { url: '/auth/login', method: 'post' },
    };

    const result = normalizeApiError(axiosResponseError);

    expect(result.message).toBe('Invalid credentials');
    expect(result.status).toBe(401);
  });

  it('should normalize a generic JS error', () => {
    const result = normalizeApiError(new Error('boom'));

    expect(result).toEqual({
      message: 'boom',
      code: 'js_error',
    });
  });

  it('should normalize a non-Error unknown value', () => {
    const result = normalizeApiError('some string');

    expect(result).toEqual({
      message: 'An unknown error occurred.',
      code: 'unknown_error',
    });
  });
});
