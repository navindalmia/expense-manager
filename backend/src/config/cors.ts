/**
 * CORS allowlist.
 *
 * CORS_ORIGINS is a comma-separated list of exact origins. When unset, the
 * Expo web dev origins are allowed outside production; in production an unset
 * list means no browser origin is allowed (never a wildcard). Native apps send
 * no Origin header and are not subject to CORS, so they are unaffected.
 */
import { CorsOptions } from 'cors';

const DEV_DEFAULT_ORIGINS: readonly string[] = ['http://localhost:8081', 'http://localhost:19006'];

export function parseAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0 && o !== '*');
  }
  return env.NODE_ENV === 'production' ? [] : [...DEV_DEFAULT_ORIGINS];
}

export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const allowed = parseAllowedOrigins(env);
  return {
    exposedHeaders: ['Retry-After'],
    // Requests without an Origin (native apps, curl, same-origin) pass through.
    origin: (origin, callback) => callback(null, !origin || allowed.includes(origin)),
  };
}
