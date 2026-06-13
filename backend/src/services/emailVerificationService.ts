/**
 * Email Verification Service
 * 
 * Handles email verification token generation, storage, and verification
 * Secure single-use tokens with 24-hour expiry
 * Production-grade: SendGrid only
 */

import prisma from '../lib/prisma';
import { randomBytes } from 'crypto';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

// Token expiry: 24 hours
const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate cryptographically secure verification token
 * Format: vrf_<32-byte hex string>
 */
export function generateVerificationToken(): string {
  return `vrf_${randomBytes(32).toString('hex')}`;
}

/**
 * Create verification token in database
 * @param userId User ID
 * @returns Token string
 */
export async function createVerificationToken(userId: number): Promise<string> {
  try {
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    logger.info('Verification token created', { userId, expiresAt });
    return token;
  } catch (error) {
    logger.error('Failed to create verification token', error, { userId });
    throw new AppError('Failed to create verification token', 500, 'TOKEN_CREATION_ERROR');
  }
}

/**
 * Send verification email to user
 * Production-grade: SendGrid only
 * @param email User email
 * @param token Verification token
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  try {
    // Require SendGrid configuration
    if (!process.env.SENDGRID_API_KEY) {
      throw new AppError('Email service not configured', 500, 'EMAIL_SERVICE_ERROR');
    }

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    // Get configurable values with sensible defaults
    const appScheme = process.env.APP_SCHEME || 'expensemanager://';
    const appName = process.env.APP_NAME || 'Expense Manager';
    const appFrontendUrl = process.env.APP_FRONTEND_URL || 'https://app.expensemanager.io';
    
    // Deep link for mobile app
    const deepLink = `${appScheme}verify-email/${token}`;
    // Web link fallback
    const webLink = `${appFrontendUrl}/verify-email?token=${token}`;
    
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@expensemanager.app',
      subject: `Verify Your Email - ${appName}`,
      html: `
        <h2>Verify Your Email</h2>
        <p>Welcome to ${appName}!</p>
        <p>Click the button below to verify your email address:</p>
        <p>
          <a href="${webLink}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Verify Email
          </a>
        </p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't create this account, you can safely ignore this email.</p>
      `,
    };
    
    await sgMail.send(msg);
    logger.info('Verification email sent via SendGrid', { email });
  } catch (error) {
    logger.error('Failed to send verification email', error, { email });
    if (error instanceof Error && 'response' in error) {
      const response = (error as any).response;
      if (response?.body?.errors) {
        logger.error('SendGrid error details', { errors: response.body.errors });
      }
    }
    throw new AppError('Failed to send verification email', 500, 'EMAIL_SEND_ERROR');
  }
}

/**
 * Verify token and mark email as verified
 * @param token Verification token from email link
 * @returns User data after verification
 */
export async function verifyEmail(token: string) {
  try {
    // Find token
    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // Check if token exists
    if (!tokenRecord) {
      throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
    }

    // Check if already used
    if (tokenRecord.isUsed) {
      throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
    }

    // Check if expired
    if (new Date() > tokenRecord.expiresAt) {
      throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
    }

    // CRITICAL: Wrap both updates in transaction to prevent data corruption
    // If token is marked used but user update fails, user is locked out forever
    const verifiedUser = await prisma.$transaction(async (tx) => {
      // Mark token as used
      await tx.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });

      // Mark user email as verified
      return tx.user.update({
        where: { id: tokenRecord.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
        },
      });
    });

    logger.info('Email verified successfully', {
      userId: verifiedUser.id,
      email: verifiedUser.email,
    });

    return verifiedUser;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error verifying email', error);
    throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
  }
}

/**
 * Resend verification email (generic response to prevent enumeration)
 * @param email User email
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  try {
    // Find user - silently fail if not found
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Silent fail - don't reveal if email exists
      logger.info('Resend requested for non-existent email', { email });
      return;
    }

    // If already verified, silently fail
    if (user.emailVerified) {
      logger.info('Resend requested for already verified email', { email, userId: user.id });
      return;
    }

    // Delete any existing tokens for this user
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new token
    const token = await createVerificationToken(user.id);

    // Send email
    await sendVerificationEmail(user.email!, token);

    logger.info('Verification email resent', { userId: user.id, email });
  } catch (error) {
    logger.error('Error resending verification email', error, { email });
    // Don't throw - maintain generic response
    return;
  }
}

/**
 * Clean up expired tokens (can be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await prisma.emailVerificationToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info('Cleaned up expired verification tokens', { count: result.count });
    return result.count;
  } catch (error) {
    logger.error('Error cleaning up expired tokens', error);
    return 0;
  }
}
