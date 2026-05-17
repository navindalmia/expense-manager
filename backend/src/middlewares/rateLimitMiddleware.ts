/**
 * Rate Limiting Middleware
 * 
 * Implements IP-based and user-based rate limiting using Redis
 * For MVP without Redis: Uses in-memory store (NOT production-ready)
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

/**
 * In-memory store for rate limiting (MVP only)
 * In production: Replace with Redis
 * 
 * Format: { key: { count: number, resetTime: Date } }
 */
const rateLimitStore = new Map<string, { count: number; resetTime: Date }>();

/**
 * Rate limit configuration
 */
export const RATE_LIMIT_CONFIG = {
  resendVerification: {
    maxRequests: 5,        // 5 emails per window
    windowMs: 60 * 60 * 1000,  // 1 hour
    message: 'Too many verification emails. Please try again later.',
  },
  verifyEmail: {
    maxRequests: 10,       // 10 attempts per window (brute-force protection)
    windowMs: 60 * 60 * 1000,  // 1 hour
    message: 'Too many verification attempts. Please try again later.',
  },
  signup: {
    maxRequests: 5,        // 5 signups per hour per IP
    windowMs: 60 * 60 * 1000,
    message: 'Too many signup attempts. Please try again later.',
  },
};

/**
 * Generic rate limiting middleware factory
 * @param config Rate limit configuration
 * @param keyFn Function to extract the key (IP, user ID, email, etc)
 */
export function createRateLimitMiddleware(
  config: { maxRequests: number; windowMs: number; message: string },
  keyFn: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = new Date();
    const entry = rateLimitStore.get(key);

    // Reset if window expired
    if (!entry || entry.resetTime < now) {
      rateLimitStore.set(key, { count: 1, resetTime: new Date(now.getTime() + config.windowMs) });
      next();
      return;
    }

    // Check if limit exceeded - RETURN EARLY, don't call next()
    if (entry.count >= config.maxRequests) {
      res.status(429).json({
        success: false,
        message: config.message,
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000),
      });
      return;
    }

    // Increment counter and proceed
    entry.count++;
    next();
  };
}

/**
 * Rate limit for resend verification by user email
 * Limit: 5 emails per hour per email address
 */
export function rateLimitResendVerification(req: Request, res: Response, next: NextFunction) {
  const { email } = req.body;
  const key = `resend-verification:${email?.toLowerCase() || 'unknown'}`;
  createRateLimitMiddleware(RATE_LIMIT_CONFIG.resendVerification, () => key)(req, res, next);
}

/**
 * Rate limit for verify email by IP address
 * Limit: 10 attempts per hour per IP (brute-force protection)
 */
export function rateLimitVerifyEmail(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const key = `verify-email:${ip}`;
  createRateLimitMiddleware(RATE_LIMIT_CONFIG.verifyEmail, () => key)(req, res, next);
}

/**
 * Rate limit for signup by IP address
 * Limit: 5 signups per hour per IP (prevents account creation abuse)
 */
export function rateLimitSignup(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const key = `signup:${ip}`;
  createRateLimitMiddleware(RATE_LIMIT_CONFIG.signup, () => key)(req, res, next);
}
