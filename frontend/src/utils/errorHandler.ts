/**
 * Error Handler Utility
 * 
 * Screen-level error handling for API responses.
 * - Converts Axios/API errors to user-friendly ErrorDisplay
 * - Classifies errors by type (network, validation, auth, server)
 * - Extracts translated messages from backend
 * - Provides retry and monitoring integration points
 * 
 * Note: Low-level Axios errors are normalized by api/http/error.ts
 * This utility transforms those normalized errors for screen display.
 */

import { logger } from './logger';
import { ErrorCodes, HTTP_STATUS_RANGES, type ErrorCode } from './errorCodes';

/**
 * Error payload structure from HTTP layer.
 * Matches ApiErrorPayload from api/http/error.ts (normalized Axios response).
 */
interface ApiErrorPayload {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Structured error information for screen display and handling.
 * Classifies error type and provides necessary metadata.
 */
export interface ErrorDisplay {
  /** User-friendly message (translated by backend) */
  message: string;
  
  /** Error code for logging and analytics */
  code: ErrorCode;
  
  /** HTTP status code from backend (undefined for network errors) */
  status?: number;
  
  /** Error classification flags */
  isNetworkError: boolean;
  isValidationError: boolean;
  isAuthError: boolean;
  isNotFoundError: boolean;
  isRateLimitError: boolean;
  isServerError: boolean;
  
  /** Retry metadata */
  isRetryable: boolean;
  retryAfterSeconds?: number;
}

/**
 * Classifies and formats API errors for screen display.
 * Extracts translated messages from backend, applies fallbacks.
 * 
 * @param error - Unknown error from service layer
 * @returns ErrorDisplay - Classified error with display metadata
 * @example
 * ```typescript
 * try {
 *   await getExpenses();
 * } catch (error) {
 *   const errorDisplay = handleApiError(error);
 *   showAlert(errorDisplay.message);
 *   if (errorDisplay.isRetryable) showRetryButton();
 * }
 * ```
 */
export function handleApiError(error: unknown): ErrorDisplay {
  const apiError = extractApiError(error);

  if (!apiError) {
    return buildErrorDisplay(
      'An unexpected error occurred. Please try again.',
      ErrorCodes.UNKNOWN_ERROR,
      undefined
    );
  }

  return classifyAndBuildError(apiError);
}

/**
 * Classifies API error and builds ErrorDisplay with all metadata.
 * 
 * @internal
 */
function classifyAndBuildError(apiError: ApiErrorPayload): ErrorDisplay {
  const status = apiError.status;
  const code = (apiError.code || ErrorCodes.UNKNOWN_ERROR) as ErrorCode;

  // Classify by HTTP status code
  const isNetworkError =
    code === ErrorCodes.NETWORK_ERROR ||
    code === ErrorCodes.TIMEOUT ||
    code === ErrorCodes.CONNECTION_REFUSED;

  const isValidationError = status === HTTP_STATUS_RANGES.VALIDATION;
  const isAuthError = status === HTTP_STATUS_RANGES.UNAUTHORIZED;
  const isForbiddenError = status === HTTP_STATUS_RANGES.FORBIDDEN;
  const isNotFoundError = status === HTTP_STATUS_RANGES.NOT_FOUND;
  const isConflictError = status === HTTP_STATUS_RANGES.CONFLICT;
  const isRateLimitError = status === HTTP_STATUS_RANGES.RATE_LIMIT;
  const isServerError = (status ?? 0) >= HTTP_STATUS_RANGES.SERVER_ERROR_START;

  const isRetryable = isNetworkError || isRateLimitError;

  const errorDisplay: ErrorDisplay = {
    message: apiError.message,
    code: validateErrorCode(code),
    status,
    isNetworkError,
    isValidationError,
    isAuthError,
    isNotFoundError,
    isRateLimitError,
    isServerError,
    isRetryable,
    retryAfterSeconds: extractRetryAfter(apiError),
  };

  // Log for monitoring and debugging
  logErrorContext(errorDisplay);

  return errorDisplay;
}

/**
 * Extracts API error from various error types.
 * Handles Axios errors, native Errors, and pre-normalized ApiErrorPayload.
 * 
 * @internal
 */
function extractApiError(error: unknown): ApiErrorPayload | null {
  // Already normalized by HTTP layer
  if (isApiErrorPayload(error)) {
    return error;
  }

  // Axios error with HTTP response
  if (isAxiosError(error)) {
    const axiosError = error as any;

    // Backend returned JSON error response
    if (axiosError.response?.data?.error) {
      return {
        message: axiosError.response.data.error,
        code: axiosError.response.data.code,
        status: axiosError.response.status,
      };
    }

    // Connection timeout
    if (axiosError.code === 'ECONNABORTED') {
      return {
        message: 'Request timed out. Please try again.',
        code: ErrorCodes.TIMEOUT,
        status: undefined,
      };
    }

    // Network error (no response from server)
    if (!axiosError.response) {
      return {
        message: 'Network error. Check your connection.',
        code: ErrorCodes.NETWORK_ERROR,
        status: undefined,
      };
    }

    // Unexpected Axios error
    return {
      message: axiosError.message || 'Request failed',
      code: ErrorCodes.NETWORK_ERROR,
      status: axiosError.response?.status,
    };
  }

  // JavaScript Error
  if (error instanceof Error) {
    return {
      message: error.message || 'An error occurred',
      code: ErrorCodes.JS_ERROR,
      status: undefined,
    };
  }

  return null;
}

/**
 * Type guard: validates value is ApiErrorPayload shape.
 * 
 * @internal
 */
function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return typeof obj.message === 'string' && (typeof obj.code === 'string' || obj.code === undefined);
}

/**
 * Type guard: validates value is Axios error with isAxiosError flag.
 * 
 * @internal
 */
function isAxiosError(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isAxiosError' in value &&
    (value as any).isAxiosError === true
  );
}

/**
 * Validates error code against known values.
 * Falls back to UNKNOWN_ERROR if invalid.
 * 
 * @internal
 */
function validateErrorCode(code: unknown): ErrorCode {
  if (typeof code === 'string' && Object.values(ErrorCodes).includes(code as ErrorCode)) {
    return code as ErrorCode;
  }
  return ErrorCodes.UNKNOWN_ERROR;
}

/**
 * Extracts Retry-After header value (seconds) if present.
 * Used for rate-limit and server error recovery.
 * 
 * @internal
 */
function extractRetryAfter(apiError: ApiErrorPayload): number | undefined {
  // Could be implemented when header access is added to ApiErrorPayload
  // return parseInt(headers['retry-after'], 10) || undefined;
  return undefined;
}

/**
 * Builds ErrorDisplay with standard structure.
 * 
 * @internal
 */
function buildErrorDisplay(
  message: string,
  code: ErrorCode,
  status?: number
): ErrorDisplay {
  return {
    message,
    code,
    status,
    isNetworkError: false,
    isValidationError: false,
    isAuthError: false,
    isNotFoundError: false,
    isRateLimitError: false,
    isServerError: false,
    isRetryable: false,
  };
}

/**
 * Logs error context for monitoring and debugging.
 * Integrates with logger utility for centralized logging.
 * 
 * @internal
 */
function logErrorContext(errorDisplay: ErrorDisplay): void {
  const logLevel = errorDisplay.isServerError ? 'error' : 'warn';
  const logMessage = `API error: ${errorDisplay.code}`;

  logger[logLevel](logMessage, {
    code: errorDisplay.code,
    status: errorDisplay.status,
    isNetworkError: errorDisplay.isNetworkError,
    isValidationError: errorDisplay.isValidationError,
    isAuthError: errorDisplay.isAuthError,
    isRateLimitError: errorDisplay.isRateLimitError,
    isServerError: errorDisplay.isServerError,
  });
}

/**
 * Extracts translated error message for display.
 * Shorthand when only message is needed.
 * 
 * @param error - Unknown error from service
 * @returns User-friendly message string
 * @example
 * ```typescript
 * const message = getErrorMessage(error);
 * showToast(message);
 * ```
 */
export function getErrorMessage(error: unknown): string {
  return handleApiError(error).message;
}

/**
 * Determines if caller should retry the operation.
 * True for network errors and rate-limit errors.
 * 
 * @param error - Unknown error from service
 * @returns boolean - true if operation is retryable
 * @example
 * ```typescript
 * if (isRetryableError(error)) {
 *   showRetryButton();
 * } else {
 *   showErrorMessage(error);
 * }
 * ```
 */
export function isRetryableError(error: unknown): boolean {
  return handleApiError(error).isRetryable;
}

/**
 * Checks if error is authentication-related.
 * Used to redirect to login if token expired.
 * 
 * @param error - Unknown error from service
 * @returns boolean - true if auth error (401)
 */
export function isAuthError(error: unknown): boolean {
  return handleApiError(error).isAuthError;
}

/**
 * Checks if error is due to rate limiting.
 * Used to show backoff guidance and retry timing.
 * 
 * @param error - Unknown error from service
 * @returns boolean - true if rate limited (429)
 */
export function isRateLimitError(error: unknown): boolean {
  return handleApiError(error).isRateLimitError;
}

