/**
 * Rate Limit Middleware Tests
 *
 * The underlying store is shared module-level state with no reset hook,
 * so each test uses a unique key (unique email/IP) to stay isolated from
 * other tests and previous runs within the same file.
 */

import { Request, Response, NextFunction } from 'express';
import {
  createRateLimitMiddleware,
  rateLimitResendVerification,
  rateLimitSignup,
} from '../rateLimitMiddleware';

function makeRes() {
  let statusCode = 200;
  let jsonData: any = null;
  const res = {
    status: jest.fn().mockImplementation((code: number) => {
      statusCode = code;
      return res;
    }),
    json: jest.fn().mockImplementation((data) => {
      jsonData = data;
      return res;
    }),
  } as unknown as Response;
  return { res, getStatus: () => statusCode, getJson: () => jsonData };
}

describe('createRateLimitMiddleware', () => {
  it('allows requests under the configured threshold', () => {
    const middleware = createRateLimitMiddleware(
      { maxRequests: 3, windowMs: 60_000, message: 'Too many requests' },
      () => 'test-key-under-threshold'
    );
    const next = jest.fn() as unknown as NextFunction;
    const { res } = makeRes();

    middleware({} as Request, res, next);
    middleware({} as Request, res, next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('rejects requests over the threshold with 429 and does not call next()', () => {
    const middleware = createRateLimitMiddleware(
      { maxRequests: 2, windowMs: 60_000, message: 'Too many requests' },
      () => 'test-key-over-threshold'
    );
    const next = jest.fn() as unknown as NextFunction;
    const { res, getStatus, getJson } = makeRes();

    middleware({} as Request, res, next); // 1st: allowed, count -> 1
    middleware({} as Request, res, next); // 2nd: allowed, count -> 2
    middleware({} as Request, res, next); // 3rd: rejected

    expect(next).toHaveBeenCalledTimes(2);
    expect(getStatus()).toBe(429);
    expect(getJson().error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('resets the window after it expires', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const middleware = createRateLimitMiddleware(
      { maxRequests: 1, windowMs: 10_000, message: 'Too many requests' },
      () => 'test-key-window-reset'
    );
    const next = jest.fn() as unknown as NextFunction;
    const { res } = makeRes();

    middleware({} as Request, res, next); // consumes the only allowed request

    jest.setSystemTime(new Date('2026-01-01T00:00:11Z')); // window has expired
    middleware({} as Request, res, next); // allowed again

    jest.useRealTimers();

    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe('rateLimitResendVerification', () => {
  it('keys the limit by the request body email', () => {
    const next = jest.fn() as unknown as NextFunction;
    const { res, getStatus } = makeRes();
    const req = { body: { email: 'unique-resend-test@example.com' } } as Request;

    rateLimitResendVerification(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(getStatus()).toBe(200);
  });
});

describe('rateLimitSignup', () => {
  it('keys the limit by request IP', () => {
    const next = jest.fn() as unknown as NextFunction;
    const { res } = makeRes();
    const req = { ip: '203.0.113.42-unique-signup-test' } as Request;

    rateLimitSignup(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
