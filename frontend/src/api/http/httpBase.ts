
/**

 * Responsibility:
 *  - Create and export a single Axios instance configured with baseURL, timeout and JSON headers.

 * Notes:
 *  - Reads EXPO_PUBLIC_API_BASE_URL 
 *  - Trims trailing slashes to avoid duplicate-slash issues when composing paths.

 */

import axios from "axios";


const rawBase = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();

/**
 * When this variable is missing the app cannot contact the backend.
 */
if (!rawBase) {
  throw new Error(
    "[http/base] EXPO_PUBLIC_API_BASE_URL is not defined. " +
      "Add EXPO_PUBLIC_API_BASE_URL to your .env (frontend root) or to your build environment."
  );
}

/** Ensure no trailing slash on base (keeps URL composition predictable) */
const API_BASE_URL = rawBase.replace(/\/+$/, "");

/** Create an Axios instance */
export const httpBase = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000, // 15s: balanced default for mobile networks
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});
export type HttpClient = typeof httpBase;

