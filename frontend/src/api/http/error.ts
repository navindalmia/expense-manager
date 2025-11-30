
/**
 * Responsibility:
 *  - Normalize all API errors into a consistent frontend shape.
 *  - Handle Axios errors, network failures, timeouts, and generic JS errors.

 */

export interface ApiErrorPayload {
  
  message: string;

  code?: string;

  /** Optional HTTP status code */
  status?: number;
}

/**
 * Converts any error into a consistent ApiErrorPayload
 */
export function normalizeApiError(err: unknown): ApiErrorPayload {
  //  Axios errors (runtime detection using `isAxiosError`)
  if (err && typeof err === "object" && "isAxiosError" in err && (err as any).isAxiosError) {
    const axiosErr = err as any; // safe runtime cast

    // Backend responded with JSON { error, code }
    if (axiosErr.response?.data?.error) {
      return {
        message: axiosErr.response.data.error,
        code: axiosErr.response.data.code || 'api_error',
        status: axiosErr.response.status,
      };
    }

    // Timeout
    if (axiosErr.code === "ECONNABORTED") {
      return {
        message: "Request timed out. Please try again.",
        code: "timeout"
      };
    }

    // Network errors (no response)
    if (!axiosErr.response) {
      return {
        message: "Network error. Check your connection.",
        code: "network_error"
      };
    }

    // Fallback
    return {
      message: axiosErr.message || 'An unknown network error occurred',
      code: "fallback_network_error",
      status: axiosErr.response?.status,
    };
  }

  //  Generic JS Error
  if (err instanceof Error) {
    return {
      message: err.message || "An unknown JS error occurred.",
      code: "js_error"
    };
  }

  //  Unknown error type
  return {
    message: "An unknown error occurred.",
    code: "unknown_error"
  };
}
