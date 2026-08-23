/**
 * Responsibility:
 *  - Create and export a single Axios instance configured with baseURL, timeout and JSON headers.
 *  - This is the ONLY place that reads EXPO_PUBLIC_API_BASE_URL and builds the axios client —
 *    do not duplicate this logic elsewhere (see docs/solutions/... env-config restructure notes).
 *
 * Notes:
 *  - EXPO_PUBLIC_API_BASE_URL comes from Expo's own .env layering, resolved per environment.
 *    See frontend/ENVIRONMENT_SETUP.md for the full precedence and per-target values
 *    (Android emulator, iOS simulator, physical device, CI).
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
      "See frontend/ENVIRONMENT_SETUP.md to set it for your environment " +
      "(local .env.development.local, EAS build profile env, or CI)."
  );
}

/** Ensure no trailing slash on base (keeps URL composition predictable) */
const API_BASE_URL = rawBase.replace(/\/+$/, "");

/** Create an Axios instance */
export const httpBase = axios.create({
  baseURL: API_BASE_URL,
  // 45s: the live backend (Render free tier) sleeps after ~15min idle and takes
  // 30-50s to wake on the next request. A shorter timeout here reliably fails a
  // new user's very first request against a cold backend. Bounded rather than
  // unlimited so a genuinely dead backend still fails within a sane window.
  timeout: 45_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});
export type HttpClient = typeof httpBase;
