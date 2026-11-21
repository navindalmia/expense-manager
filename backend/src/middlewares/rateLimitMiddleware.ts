/**
 * Rate Limiting Middleware
 *
 * Fixed-window, in-memory limiter. Per-process state: correct for a single
 * instance (current Render deployment); replace the store with Redis before
 * scaling horizontally.
 *
 * Configuration (all optional, documented in backend/.env.example):
 *   RATE_LIMIT_DISABLED=true            turn limiting off (ignored in production)
 *   RATE_LIMIT_<NAME>_MAX               requests allowed per window
 *   RATE_LIMIT_<NAME>_WINDOW_MS         window length in milliseconds
 *   with <NAME> in LOGIN, SIGNUP, VERIFY_EMAIL, RESEND_VERIFICATION
 *
 * Client IP comes from req.ip; app.ts sets `trust proxy` so that behind
 * Render's proxy it is the real client address, not the proxy's.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../errors/AppError';

interface WindowEntry {
  count: number;
  resetTime: number; // epoch ms
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const rateLimitStore = new Map<string, WindowEntry>();
const SWEEP_INTERVAL_MS = 60 * 1000;
let sweepTimer: NodeJS.Timeout | undefined;

/** Removes expired entries so the store cannot grow without bound. */
export function sweepExpiredEntries(now: number = Date.now()): void {
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetTime <= now) rateLimitStore.delete(key);
  }
}

/** Starts the periodic sweep once; unref'd so it never keeps the process alive. */
function ensureSweepTimer(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => sweepExpiredEntries(), SWEEP_INTERVAL_MS);
  sweepTimer.unref();
}

/** Test helper: empties the store. */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

/** Test helper: number of tracked keys. */
export function rateLimitStoreSize(): number {
  return rateLimitStore.size;
}

/** Limiting is off only when explicitly requested, and never in production. */
function isRateLimitDisabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED === 'true' && process.env.NODE_ENV !== 'production';
}

function readPositiveInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const HOUR_MS = 60 * 60 * 1000;

/** Defaults, overridable per limiter through env; read at request time. */
export function getRateLimitConfig(name: 'LOGIN' | 'SIGNUP' | 'VERIFY_EMAIL' | 'RESEND_VERIFICATION'): RateLimitConfig {
  const defaults: Record<typeof name, RateLimitConfig> = {
    LOGIN: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
    SIGNUP: { maxRequests: 5, windowMs: HOUR_MS },
    VERIFY_EMAIL: { maxRequests: 10, windowMs: HOUR_MS },
    RESEND_VERIFICATION: { maxRequests: 5, windowMs: HOUR_MS },
  };
  return {
    maxRequests: readPositiveInt(`RATE_LIMIT_${name}_MAX`, defaults[name].maxRequests),
    windowMs: readPositiveInt(`RATE_LIMIT_${name}_WINDOW_MS`, defaults[name].windowMs),
  };
}

/**
 * Generic rate limiting middleware factory.
 * @param config Limit and window, or a function returning them (evaluated per request)
 * @param keyFn Function to extract the key (IP, email, etc)
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig | (() => RateLimitConfig),
  keyFn: (req: Request) => string
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isRateLimitDisabled()) {
      next();
      return;
    }
    ensureSweepTimer();

    const { maxRequests, windowMs } = typeof config === 'function' ? config() : config;
    const key = keyFn(req);
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime <= now) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      next(new AppError('RATE_LIMIT.EXCEEDED', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter }));
      return;
    }

    entry.count++;
    next();
  };
}

function clientIp(req: Request): string {
  return req.ip || 'unknown';
}

/** Login attempts per IP (brute-force protection). Default 10 / 15 min. */
export const rateLimitLogin = createRateLimitMiddleware(
  () => getRateLimitConfig('LOGIN'),
  (req) => `login:${clientIp(req)}`
);

/** Signups per IP. Default 5 / hour. */
export const rateLimitSignup = createRateLimitMiddleware(
  () => getRateLimitConfig('SIGNUP'),
  (req) => `signup:${clientIp(req)}`
);

/** Email verification attempts per IP. Default 10 / hour. */
export const rateLimitVerifyEmail = createRateLimitMiddleware(
  () => getRateLimitConfig('VERIFY_EMAIL'),
  (req) => `verify-email:${clientIp(req)}`
);

/** Resend-verification per target email. Default 5 / hour. */
export const rateLimitResendVerification = createRateLimitMiddleware(
  () => getRateLimitConfig('RESEND_VERIFICATION'),
  (req) => {
    const email: unknown = req.body?.email;
    return `resend-verification:${typeof email === 'string' ? email.toLowerCase() : 'unknown'}`;
  }
);
