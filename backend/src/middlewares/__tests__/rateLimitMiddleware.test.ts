/**
 * Rate limit middleware tests. State is module-level, so every test resets
 * the store and restores the env it touched.
 */

import { Request, Response, NextFunction } from 'express';
import {
  createRateLimitMiddleware,
  getRateLimitConfig,
  rateLimitResendVerification,
  rateLimitSignup,
  resetRateLimitStore,
  rateLimitStoreSize,
  sweepExpiredEntries,
} from '../rateLimitMiddleware';
import { AppError } from '../../errors/AppError';

function makeRes(): Response {
  return { setHeader: jest.fn() } as unknown as Response;
}

function run(mw: ReturnType<typeof createRateLimitMiddleware>, req: Partial<Request> = {}): { next: jest.Mock; res: Response } {
  const next = jest.fn();
  const res = makeRes();
  mw(req as Request, res, next as unknown as NextFunction);
  return { next, res };
}

const savedEnv = { ...process.env };
beforeEach(() => {
  resetRateLimitStore();
  delete process.env.RATE_LIMIT_DISABLED;
});
afterEach(() => {
  process.env = { ...savedEnv };
  jest.useRealTimers();
});

describe('createRateLimitMiddleware', () => {
  const mw = () => createRateLimitMiddleware({ maxRequests: 2, windowMs: 60_000 }, () => 'k');

  it('should allow requests under the limit', () => {
    const m = mw();
    expect(run(m).next).toHaveBeenCalledWith();
    expect(run(m).next).toHaveBeenCalledWith();
  });

  it('should return a 429 AppError with the i18n key after the limit', () => {
    const m = mw();
    run(m);
    run(m);
    const { next, res } = run(m);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(429);
    expect(err.messageKey).toBe('RATE_LIMIT.EXCEEDED');
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('should reset after the window expires', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const m = createRateLimitMiddleware({ maxRequests: 1, windowMs: 10_000 }, () => 'k');
    run(m);
    jest.setSystemTime(new Date('2026-01-01T00:00:11Z'));
    expect(run(m).next).toHaveBeenCalledWith();
  });

  it('should skip limiting when RATE_LIMIT_DISABLED=true outside production', () => {
    process.env.RATE_LIMIT_DISABLED = 'true';
    process.env.NODE_ENV = 'development';
    const m = mw();
    for (let i = 0; i < 10; i++) expect(run(m).next).toHaveBeenCalledWith();
  });

  it('should ignore RATE_LIMIT_DISABLED in production', () => {
    process.env.RATE_LIMIT_DISABLED = 'true';
    process.env.NODE_ENV = 'production';
    const m = mw();
    run(m);
    run(m);
    expect(run(m).next.mock.calls[0][0]).toBeInstanceOf(AppError);
  });

  it('should track keys independently', () => {
    const m = createRateLimitMiddleware({ maxRequests: 1, windowMs: 60_000 }, (r) => String(r.ip));
    run(m, { ip: 'a' });
    expect(run(m, { ip: 'b' }).next).toHaveBeenCalledWith();
  });
});

describe('store expiry', () => {
  it('should remove expired entries so the store does not grow unbounded', () => {
    const m = createRateLimitMiddleware({ maxRequests: 1, windowMs: 1_000 }, (r) => String(r.ip));
    for (let i = 0; i < 50; i++) run(m, { ip: `ip-${i}` });
    expect(rateLimitStoreSize()).toBe(50);
    sweepExpiredEntries(Date.now() + 2_000);
    expect(rateLimitStoreSize()).toBe(0);
  });

  it('should keep entries whose window is still open', () => {
    const m = createRateLimitMiddleware({ maxRequests: 1, windowMs: 60_000 }, () => 'live');
    run(m);
    sweepExpiredEntries(Date.now() + 1_000);
    expect(rateLimitStoreSize()).toBe(1);
  });
});

describe('getRateLimitConfig', () => {
  it('should use documented defaults', () => {
    expect(getRateLimitConfig('LOGIN')).toEqual({ maxRequests: 10, windowMs: 15 * 60 * 1000 });
    expect(getRateLimitConfig('SIGNUP')).toEqual({ maxRequests: 5, windowMs: 3_600_000 });
  });
  it('should honour env overrides and ignore invalid values', () => {
    process.env.RATE_LIMIT_LOGIN_MAX = '3';
    process.env.RATE_LIMIT_LOGIN_WINDOW_MS = 'abc';
    expect(getRateLimitConfig('LOGIN')).toEqual({ maxRequests: 3, windowMs: 15 * 60 * 1000 });
  });
});

describe('route limiters', () => {
  it('should key resend-verification by lower-cased email', () => {
    process.env.RATE_LIMIT_RESEND_VERIFICATION_MAX = '1';
    run(rateLimitResendVerification, { body: { email: 'A@x.com' } });
    const { next } = run(rateLimitResendVerification, { body: { email: 'a@X.com' } });
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
  });

  it('should key signup by IP', () => {
    process.env.RATE_LIMIT_SIGNUP_MAX = '1';
    run(rateLimitSignup, { ip: '203.0.113.1' });
    expect(run(rateLimitSignup, { ip: '203.0.113.2' }).next).toHaveBeenCalledWith();
    expect(run(rateLimitSignup, { ip: '203.0.113.1' }).next.mock.calls[0][0]).toBeInstanceOf(AppError);
  });
});
