/**
 * Authentication Middleware
 * 
 * Validates JWT tokens and attaches user info to request
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwtHelper';

/**
 * Middleware to verify JWT token from Authorization header
 * Expects format: Authorization: Bearer <token>
 * 
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'No authorization token provided',
        error: 'MISSING_TOKEN',
      });
      return;
    }

    // Verify format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        message: 'Invalid authorization header format',
        error: 'INVALID_FORMAT',
      });
      return;
    }

    const token = parts[1];
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
        error: 'MISSING_TOKEN',
      });
      return;
    }

    // Verify token validity
    const decoded = verifyToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
    };

    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Token verification failed';

    res.status(401).json({
      success: false,
      message: `Authentication failed: ${message}`,
      error: 'AUTH_FAILED',
    });
  }
}

/**
 * Optional middleware to extract user if token exists, but don't fail if missing
 * Useful for public endpoints that have optional auth
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // No token is fine, just continue
      next();
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      if (token) {
        try {
          const decoded = verifyToken(token);
        req.user = { id: decoded.userId };
      } catch {
        // Token invalid but optional, so continue anyway
      }
      }
    }

    next();
  } catch {
    // Silently continue on error for optional auth
    next();
  }
}
