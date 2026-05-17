/**
 * Email Verification Service
 * 
 * Handles email verification token generation, storage, and verification
 * Secure single-use tokens with 24-hour expiry
 */

import prisma from '../lib/prisma';
import { randomBytes } from 'crypto';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';

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
 * @param email User email
 * @param token Verification token
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  try {
    let transporter;

    // Production: Use configured email service (SendGrid, AWS SES, etc.)
    if (process.env.NODE_ENV === 'production' && process.env.SENDGRID_API_KEY) {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      // Use deep link for mobile app: expensemanager://verify-email/<token>
      const verificationLink = `expensemanager://verify-email/${token}`;
      const webLink = `${process.env.APP_FRONTEND_URL || 'https://app.expensemanager.io'}/verify-email?token=${token}`;
      
      const msg = {
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@expensemanager.app',
        subject: 'Verify Your Email - Expense Manager',
        html: `
          <h2>Verify Your Email</h2>
          <p>Welcome to Expense Manager!</p>
          <p>Click the button below to verify your email address:</p>
          <p>
            <a href="${verificationLink}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Verify Email
            </a>
          </p>
          <p>Or copy this link: <code>${verificationLink}</code></p>
          <p>This link expires in 24 hours.</p>
          <p>If you didn't create this account, you can safely ignore this email.</p>
        `,
      };
      
      await sgMail.send(msg);
      logger.info('Verification email sent via SendGrid', { email });
      return;
    }

    // Development/MVP: Use Ethereal (persistent account)
    // Set testAccount.user and testAccount.pass as env vars
    if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER,
          pass: process.env.ETHEREAL_PASS,
        },
      });
    } else {
      // Fallback: Create test account (for initial testing only)
      logger.warn('ETHEREAL_USER/ETHEREAL_PASS not configured. Using temporary test account.');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    // For development: use deep link for Expo, with fallback to web URL
    // Deep link format: expensemanager://verify-email/<token>
    const deepLink = `expensemanager://verify-email/${token}`;
    const webUrl = process.env.APP_FRONTEND_URL || 'http://localhost:8081';
    const webLink = `${webUrl}/verify-email?token=${token}`;

    const info = await transporter.sendMail({
      from: 'noreply@expensemanager.app',
      to: email,
      subject: 'Verify Your Email - Expense Manager',
      html: `
        <h2>Verify Your Email</h2>
        <p>Welcome to Expense Manager!</p>
        <p>Click the button below to verify your email address:</p>
        <p>
          <a href="${deepLink}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Verify Email
          </a>
        </p>
        <p>Or copy this link: <code>${deepLink}</code></p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't create this account, you can safely ignore this email.</p>
      `,
    });

    logger.info('Verification email sent', {
      email,
      preview: process.env.NODE_ENV === 'production' ? undefined : nodemailer.getTestMessageUrl(info),
    });
  } catch (error) {
    logger.error('Failed to send verification email', error, { email });
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
