/**
 * Error Codes
 * 
 * Centralized error code constants matching backend error definitions.
 * Eliminates magic strings and ensures consistency across frontend.
 */

/**
 * Network and client-side error codes
 */
export const ErrorCodes = {
  // Network errors
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout',
  CONNECTION_REFUSED: 'connection_refused',

  // HTTP errors
  VALIDATION_ERROR: 'validation_error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMIT: 'rate_limit',

  // Server errors
  SERVER_ERROR: 'server_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',

  // Client errors
  JS_ERROR: 'js_error',
  UNKNOWN_ERROR: 'unknown_error',
  INVALID_RESPONSE: 'invalid_response',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * HTTP status code ranges for error classification
 */
export const HTTP_STATUS_RANGES = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  SERVER_ERROR_START: 500,
} as const;
