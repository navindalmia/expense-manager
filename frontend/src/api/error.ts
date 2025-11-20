

/**
 * Represents a standard API error response from the backend.
 */
export interface ApiErrorPayload {
  error: string;          // translated or fallback error message
  code?: string;          // optional error code (e.g., EXPENSE_NOT_FOUND)
  details?: any;          // optional contextual info
  status?: number;        // optional HTTP status code
}
