import { validateRequiredEnv, getJwtSecret, areInternalRoutesEnabled } from '../env';

const LONG = 'x'.repeat(32);

describe('validateRequiredEnv', () => {
  it('should throw when JWT_SECRET is missing', () => {
    expect(() => validateRequiredEnv({ NODE_ENV: 'development' })).toThrow(/JWT_SECRET is not set/);
  });

  it('should throw when JWT_SECRET is shorter than 32 chars outside test', () => {
    expect(() => validateRequiredEnv({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/too short/);
  });

  it('should not leak the secret value in the error message', () => {
    try {
      validateRequiredEnv({ NODE_ENV: 'production', JWT_SECRET: 'supersecret-short' });
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).not.toContain('supersecret-short');
    }
  });

  it('should accept a 32+ char secret', () => {
    expect(() => validateRequiredEnv({ NODE_ENV: 'production', JWT_SECRET: LONG })).not.toThrow();
  });

  it('should allow a short secret only when NODE_ENV is test', () => {
    expect(() => validateRequiredEnv({ NODE_ENV: 'test', JWT_SECRET: 'short' })).not.toThrow();
  });
});

describe('getJwtSecret', () => {
  it('should return the configured secret', () => {
    expect(getJwtSecret({ JWT_SECRET: LONG })).toBe(LONG);
  });

  it('should throw instead of falling back to a default', () => {
    expect(() => getJwtSecret({})).toThrow();
  });
});

describe('areInternalRoutesEnabled', () => {
  it('should be off by default', () => {
    expect(areInternalRoutesEnabled({ NODE_ENV: 'development' })).toBe(false);
  });
  it('should be on only with the explicit flag outside production', () => {
    expect(areInternalRoutesEnabled({ NODE_ENV: 'development', ENABLE_INTERNAL_ROUTES: 'true' })).toBe(true);
  });
  it('should stay off in production even with the flag', () => {
    expect(areInternalRoutesEnabled({ NODE_ENV: 'production', ENABLE_INTERNAL_ROUTES: 'true' })).toBe(false);
  });
});
