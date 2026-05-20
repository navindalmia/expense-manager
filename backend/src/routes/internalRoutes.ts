import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import {
  getEmailVerificationState,
  verifyTokenExists,
  getUnverifiedUsers,
  clearTestEmailData,
  generateEmailVerificationReport,
} from '../__tests__/utils/databaseVerification';

const router = Router();

/**
 * INTERNAL/TEST ENDPOINTS ONLY
 * These endpoints are for E2E testing and should NOT be exposed in production
 * 
 * Routes:
 * - GET  /health - Health check
 * - POST /verify-user - Get user verification state
 * - POST /get-token - Get verification token for user
 * - POST /verify-token - Check if token exists and is valid
 * - GET  /unverified-users - List unverified users
 * - DELETE /clear-user - Clear test user data
 * - GET  /report - Generate verification report
 */

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * Get email verification state for a user
 * POST /internal/verify-user { email: string }
 */
router.post('/verify-user', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    const state = await getEmailVerificationState(email);

    if (!state) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json(state);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get active verification token for a user
 * POST /internal/get-token { userId: number }
 */
router.post('/get-token', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'UserId required' });
      return;
    }

    const token = await prisma.emailVerificationToken.findFirst({
      where: {
        userId,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        token: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: {
        expiresAt: 'desc',
      },
    });

    if (!token) {
      res.status(404).json({ error: 'No active token found' });
      return;
    }

    res.status(200).json(token);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify if token is valid
 * POST /internal/verify-token { token: string }
 */
router.post('/verify-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }

    const valid = await verifyTokenExists(token);

    res.status(200).json({
      valid,
      token,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all unverified users
 * GET /internal/unverified-users
 */
router.get('/unverified-users', async (req: Request, res: Response) => {
  try {
    const users = await getUnverifiedUsers();

    res.status(200).json({
      count: users.length,
      users,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear test user (delete user and all associated tokens)
 * DELETE /internal/clear-user { email: string }
 */
router.delete('/clear-user', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete tokens first (FK constraint)
    const tokenDeleteCount = await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    // Delete user
    await prisma.user.deleteMany({
      where: { email },
    });

    res.status(200).json({
      message: 'User cleared successfully',
      email,
      tokensDeleted: tokenDeleteCount.count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate verification report
 * GET /internal/report
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const report = await generateEmailVerificationReport();

    res.status(200).json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear all test users (for test setup/cleanup)
 * DELETE /internal/clear-all-test-users
 */
router.delete('/clear-all-test-users', async (req: Request, res: Response) => {
  try {
    // Delete all users with test email pattern (e2e-*@example.com)
    const testUserCount = await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'e2e-test-',
          endsWith: '@example.com',
        },
      },
    });

    res.status(200).json({
      message: 'Test users cleared successfully',
      deletedCount: testUserCount.count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
