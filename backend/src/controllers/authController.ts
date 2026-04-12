/**
 * Authentication Controller
 * 
 * Handles user signup, login, and token management
 * Production-grade with password hashing and validation
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateToken } from '../utils/jwtHelper';
import { hashPassword, comparePassword, isCommonPassword } from '../utils/passwordHelper';
import { validateSignup, validateLogin } from '../schemas/authSchema';
import { ZodError } from 'zod';

const ACCOUNT_LOCKOUT_THRESHOLD = 5;
const ACCOUNT_LOCKOUT_DURATION_MINUTES = 15;

/**
 * User signup / registration endpoint
 * POST /api/auth/signup
 * 
 * Accepts: { email, password, name }
 * Returns: { token, user }
 */
export async function signup(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const { email, password, name } = validateSignup(req.body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let user;

    if (existingUser) {
      // If user exists but no password → they were invited as placeholder, activate now
      if (!existingUser.password) {
        // Link placeholder user: add password and update name if provided
        const hashedPassword = await hashPassword(password);
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            password: hashedPassword,
            name: name || existingUser.name, // Use provided name or keep existing
          },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });
      } else {
        // User already has password → genuine duplicate
        res.status(409).json({
          success: false,
          message: 'Unable to create account. Please try another email.',
          error: 'EMAIL_CONFLICT',
        });
        return;
      }
    } else {
      // Check if password is common
      if (isCommonPassword(password)) {
        res.status(400).json({
          success: false,
          message: 'This password is too common. Please choose a stronger password.',
          error: 'WEAK_PASSWORD',
        });
        return;
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });
    }

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const zodError = error as ZodError<unknown>;
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
        details: zodError.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: 'SERVER_ERROR',
    });
  }
}

/**
 * User login endpoint
 * POST /api/auth/login
 * 
 * Accepts: { email, password }
 * Returns: { token, user }
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const { email, password } = validateLogin(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        isActive: true,
        lockedUntil: true,
        failedLoginAttempts: true,
      },
    });

    // Generic error message for security (don't reveal if user exists)
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'AUTH_FAILED',
      });
      return;
    }

    // Check if account is deactivated
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account has been deactivated',
        error: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      res.status(429).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.',
        error: 'ACCOUNT_LOCKED',
      });
      return;
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password || '');

    if (!isPasswordValid) {
      // Increment failed login attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newFailedAttempts >= ACCOUNT_LOCKOUT_THRESHOLD;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MINUTES * 60 * 1000)
            : null,
        },
      });

      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'AUTH_FAILED',
      });
      return;
    }

    // Login successful - reset failed attempts and update lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const zodError = error as ZodError<unknown>;
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
        details: zodError.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: 'SERVER_ERROR',
    });
  }
}

/**
 * Get current authenticated user
 * GET /api/auth/me
 * Protected: Requires valid JWT token
 */
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user info',
      error: 'SERVER_ERROR',
    });
  }
}

/**
 * Logout endpoint
 * POST /api/auth/logout
 * Protected: Requires valid JWT token
 * 
 * Note: Invalidates token on client-side (remove from localStorage)
 * For actual server-side token blacklist, see Phase 2
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
        error: 'UNAUTHORIZED',
      });
      return;
    }

    // In Phase 3: Add token to blacklist in Redis/DB
    // For now: Just confirm logout on frontend

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: 'SERVER_ERROR',
    });
  }
}
