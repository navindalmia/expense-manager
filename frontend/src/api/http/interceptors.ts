import { httpBase } from "./httpBase";
import { normalizeApiError } from "./error";
import { getLanguage } from "./language";
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Module-level token storage
 * Updated by AuthContext when user logs in/out
 */
let authToken: string | null = null;

/**
 * Logout callback
 * Set by App navigation to handle 401 redirects
 */
let onUnauthorized: (() => void) | null = null;

/**
 * Set the JWT token for subsequent requests
 * Called by AuthContext after login/signup
 */
export function setAuthToken(token: string | null) {
  authToken = token;
}

/**
 * Set the logout callback for 401 handling
 * Called by App setup to handle unauthorized redirects
 */
export function setOnUnauthorized(callback: () => void) {
  onUnauthorized = callback;
}

/**
 * Handle 401 response - clear token and redirect to login
 */
async function handle401() {
  // Clear token from storage and state
  await AsyncStorage.multiRemove(['@expense_manager_token', '@expense_manager_user']);
  setAuthToken(null);

  // Call logout callback if set (triggers navigation to login)
  if (onUnauthorized) {
    onUnauthorized();
  }
}

/**
 * Attach request and response interceptors to a given Axios instance
 */
export function attachInterceptors(client: typeof httpBase) {
  client.interceptors.request.use(
    (config) => {
      config.headers = config.headers ?? {};
      config.headers["Accept-Language"] = getLanguage();

      // Add Bearer token if available
      if (authToken) {
        config.headers["Authorization"] = `Bearer ${authToken}`;
      }

      return config;
    },
    (error) => Promise.reject(normalizeApiError(error))
  );

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      // Handle 401 Unauthorized - token expired or invalid
      if (error?.response?.status === 401) {
        handle401();
      }
      return Promise.reject(normalizeApiError(error));
    }
  );
}
