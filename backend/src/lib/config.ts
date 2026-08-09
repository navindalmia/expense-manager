/**
 * Small app-wide config flags read from environment variables.
 * Centralised here so behaviour toggles aren't duplicated/re-parsed at each call site.
 */

/**
 * Whether unverified users are blocked from logging in / using verification-gated features.
 * Defaults to true (current behaviour) when the env var is unset, so no existing deployment
 * changes behaviour unless it explicitly opts out via REQUIRE_EMAIL_VERIFICATION=false.
 */
export function isEmailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';
}
