
// -------------------------------------------------------------
//  API Configuration (Base URL, timeouts, default headers)
//  - Reads Expo public env variables
//  - Validates baseURL early to avoid silent runtime failures
//  - Exported config is used when creating axios instance
// -------------------------------------------------------------

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Fail early in development if no URL is provided
if (!baseURL) {
  throw new Error(
    "[API CONFIG] EXPO_PUBLIC_API_BASE_URL is missing. " +
    "Define it in your .env files (e.g., .env.development)."
  );
}

export const apiConfig = {
  baseURL,
  // 45 seconds — the live backend (Render free tier) sleeps after ~15min
  // idle and takes 30-50s to wake on the next request. A short timeout here
  // reliably fails a new user's very first request against a cold backend.
  timeout: 45000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
} as const;