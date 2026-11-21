/**
 * Startup environment validation (fail closed).
 *
 * The JWT secret has NO fallback: a missing or weak secret stops the server
 * from starting. Secret values are never included in error messages or logs.
 *
 * Tests: NODE_ENV=test is exempt from the length rule, and
 * src/__tests__/setup.ts defaults JWT_SECRET so unit tests keep working.
 */

export const MIN_JWT_SECRET_LENGTH = 32;

type Env = NodeJS.ProcessEnv;

/** Throws a clear (secret-free) error if the environment is unsafe to run with. */
export function validateRequiredEnv(env: Env = process.env): void {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Refusing to start: configure a random secret of at least 32 characters.');
  }
  if (env.NODE_ENV !== 'test' && secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is too short. Refusing to start: it must be at least ${MIN_JWT_SECRET_LENGTH} characters.`
    );
  }
}

/** Returns the JWT secret, throwing if unset. Read lazily so dotenv has run. */
export function getJwtSecret(env: Env = process.env): string {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set.');
  }
  return secret;
}

/** True when the explicit opt-in for the internal test-support routes is set. */
export function areInternalRoutesEnabled(env: Env = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.ENABLE_INTERNAL_ROUTES === 'true';
}
