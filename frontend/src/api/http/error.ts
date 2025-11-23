
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
  // 1️⃣ Axios errors (runtime detection using `isAxiosError`)
  if (err && typeof err === "object" && "isAxiosError" in err && (err as any).isAxiosError) {
    const axiosErr = err as any; // safe runtime cast

    // Backend responded with JSON { error, code }
    if (axiosErr.response?.data?.error) {
      return {
        message: axiosErr.response.data.error,
        code: axiosErr.response.data.code,
        status: axiosErr.response.status,
      };
    }

    // Timeout
    if (axiosErr.code === "ECONNABORTED") {
      return {
        message: "Request timed out. Please try again.",
      };
    }

    // Network errors (no response)
    if (!axiosErr.response) {
      return {
        message: "Network error. Check your connection.",
      };
    }

    // Fallback
    return {
      message: axiosErr.message,
      status: axiosErr.response.status,
    };
  }

  // 2️⃣ Generic JS Error
  if (err instanceof Error) {
    return {
      message: err.message || "An unknown error occurred.",
    };
  }

  // 3️⃣ Unknown error type
  return {
    message: "An unknown error occurred.",
  };
}
