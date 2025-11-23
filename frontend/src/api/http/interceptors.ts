import { httpBase } from "./httpBase";
import { normalizeApiError } from "./error";
import { getLanguage } from "./language";

/**
 * Attach request and response interceptors to a given Axios instance
 */
export function attachInterceptors(client: typeof httpBase) {
  client.interceptors.request.use(
    (config) => {
      config.headers = config.headers ?? {};
      config.headers["Accept-Language"] = getLanguage();
      return config;
    },
    (error) => Promise.reject(normalizeApiError(error))
  );

  client.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(normalizeApiError(error))
  );
}
