/**
 * Email Verification Middleware
 * 
 * Protects endpoints that require verified email address
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * Middleware to ensure user's email is verified
 * Protected: Requires valid JWT token
 * 
 * Attaches emailVerified status to req.user
 * Returns 403 if email not verified
 */
export async function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      });
      return;
    }

    // Fetch user's verification status
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, emailVerified: true, email: true },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
      return;
    }

    if (!user.emailVerified) {
      logger.info('Access denied to unverified user', {
        userId: req.user.id,
        email: user.email,
      });
      res.status(403).json({
        success: false,
        message: 'Please verify your email before accessing this feature',
        error: 'EMAIL_NOT_VERIFIED',
        data: {
          email: user.email,
          hint: 'Check your inbox for verification email or request a new one',
        },
      });
      return;
    }

    // Attach verification status to request
    req.user.emailVerified = true;
    next();
  } catch (error) {
    logger.error('Error checking email verification', error, {
      userId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to verify email status',
      error: 'SERVER_ERROR',
    });
  }
}

/**
 * Middleware to allow group operations by verified users only
 * This is a convenience alias for endpoints that specifically need email verification
 * 
 * Usage: Apply to group endpoints that should be verified-only
 */
export const requireVerifiedEmailForGroupOps = requireEmailVerified;
