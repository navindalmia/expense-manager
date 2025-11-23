/**
 * Responsibility:
 *  - Expose a single, ready-to-use Axios client for the frontend.
 *  - All requests automatically:
 *      • Include Accept-Language header
 *      • Handle timeouts / network errors
 *      • Normalize backend errors into ApiErrorPayload
 */

import { httpBase } from "./httpBase";
import { attachInterceptors } from "./interceptors";

// Attach interceptors once on the base client
attachInterceptors(httpBase);

// Export the ready-to-use client
export const http = httpBase;

//  export type for other API modules
export type HttpClient = typeof httpBase;
