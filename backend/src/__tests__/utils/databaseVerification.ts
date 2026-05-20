import prisma from '../../lib/prisma';

/**
 * Database Verification Utility
 * Used for end-to-end testing to verify data state after UI actions
 */

export interface EmailVerificationState {
  userId: number;
  userEmail: string | null;  // Allow null for edge cases
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  activeTokenCount: number;
  lastTokenExpiry: Date | null;
}

/**
 * Get email verification state for a specific user
 */
export async function getEmailVerificationState(email: string): Promise<EmailVerificationState | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerifiedAt: true,
      verificationTokens: {
        where: {
          isUsed: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          expiresAt: true,
        },
        orderBy: {
          expiresAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    userEmail: user.email,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    activeTokenCount: user.verificationTokens.length,
    lastTokenExpiry: user.verificationTokens[0]?.expiresAt ?? null,
  };
}

/**
 * Verify token exists and is valid
 */
export async function verifyTokenExists(token: string): Promise<boolean> {
  const result = await prisma.emailVerificationToken.findUnique({
    where: { token },
    select: {
      id: true,
      isUsed: true,
      expiresAt: true,
    },
  });

  if (!result) return false;
  if (result.isUsed) return false;
  if (result.expiresAt < new Date()) return false;

  return true;
}

/**
 * Get all users with unverified emails
 */
export async function getUnverifiedUsers(): Promise<EmailVerificationState[]> {
  const users = await prisma.user.findMany({
    where: {
      emailVerified: false,
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerifiedAt: true,
      verificationTokens: {
        where: {
          isUsed: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          expiresAt: 'desc',
        },
        take: 1,
      },
    },
  });

  return users.map((user) => ({
    userId: user.id,
    userEmail: user.email,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    activeTokenCount: user.verificationTokens.length,
    lastTokenExpiry: user.verificationTokens[0]?.expiresAt ?? null,
  }));
}

/**
 * Clear all test email verification data (for test cleanup)
 */
export async function clearTestEmailData(email: string): Promise<void> {
  // Delete tokens first (due to FK constraint)
  await prisma.emailVerificationToken.deleteMany({
    where: {
      user: {
        email,
      },
    },
  });

  // Then delete user
  await prisma.user.deleteMany({
    where: { email },
  });
}

/**
 * Generate summary report of email verification state
 */
export async function generateEmailVerificationReport(): Promise<{
  totalUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  totalTokens: number;
  activeTokens: number;
  usedTokens: number;
  expiredTokens: number;
}> {
  const users = await prisma.user.findMany({
    select: { emailVerified: true },
  });

  const tokens = await prisma.emailVerificationToken.findMany({
    select: {
      isUsed: true,
      expiresAt: true,
    },
  });

  const now = new Date();
  const expiredTokens = tokens.filter((t) => t.expiresAt < now).length;
  const activeTokens = tokens.filter((t) => !t.isUsed && t.expiresAt > now).length;
  const usedTokens = tokens.filter((t) => t.isUsed).length;

  return {
    totalUsers: users.length,
    verifiedUsers: users.filter((u) => u.emailVerified).length,
    unverifiedUsers: users.filter((u) => !u.emailVerified).length,
    totalTokens: tokens.length,
    activeTokens,
    usedTokens,
    expiredTokens,
  };
}
