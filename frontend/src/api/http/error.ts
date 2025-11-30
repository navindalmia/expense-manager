
import { logger } from '../../utils/logger';

/**
 * Responsibility:
 *  - Normalize all API errors into a consistent frontend shape.
 *  - Handle Axios errors, network failures, timeouts, and generic JS errors.
 *  - Log errors for debugging and monitoring.
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
      const errorPayload = {
        message: axiosErr.response.data.error,
        code: axiosErr.response.data.code || 'api_error',
        status: axiosErr.response.status,
      };
      
      // Log server errors (5xx) as errors, others as warnings
      if (axiosErr.response.status >= 500) {
        logger.error('Server error', axiosErr, { 
          status: axiosErr.response.status,
          url: axiosErr.config?.url,
          method: axiosErr.config?.method
        });
      } else {
        logger.warn('API error', { 
          ...errorPayload,
          url: axiosErr.config?.url,
          method: axiosErr.config?.method
        });
      }
      
      return errorPayload;
    }

    // Timeout
    if (axiosErr.code === "ECONNABORTED") {
      logger.warn('Request timeout', { 
        url: axiosErr.config?.url,
        method: axiosErr.config?.method,
        timeout: axiosErr.config?.timeout 
      });
      
      return {
        message: "Request timed out. Please try again.",
        code: "timeout"
      };
    }

    // Network errors (no response)
    if (!axiosErr.response) {
      logger.error('Network error', axiosErr, { 
        url: axiosErr.config?.url,
        method: axiosErr.config?.method
      });
      
      return {
        message: "Network error. Check your connection.",
        code: "network_error"
      };
    }

    // Fallback for unhandled Axios errors
    const errorPayload = {
      message: axiosErr.message || 'An unknown network error occurred',
      code: "fallback_network_error",
      status: axiosErr.response?.status,
    };
    
    logger.error('Unhandled API error', axiosErr, { 
      ...errorPayload,
      url: axiosErr.config?.url,
      method: axiosErr.config?.method
    });
    
    return errorPayload;
  }

  // Generic JS Error
  if (err instanceof Error) {
    const errorPayload = {
      message: err.message || "An unknown JS error occurred.",
      code: "js_error"
    };
    
    logger.error('JavaScript error', err, { 
      ...errorPayload,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
    
    return errorPayload;
  }

  // Unknown error type
  const errorPayload = {
    message: "An unknown error occurred.",
    code: "unknown_error"
  };
  
  logger.error('Unknown error type', { 
    originalError: err,
    ...errorPayload
  });
  
  return errorPayload;
}
