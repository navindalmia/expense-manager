import { Router, Request, Response, NextFunction } from 'express';
import {
  getEmailVerificationState,
  getActiveVerificationToken,
  verifyTokenExists,
  getUnverifiedUsers,
  clearUserByEmail,
  clearAllE2eTestUsers,
  generateEmailVerificationReport,
} from '../services/testSupportService';

const router = Router();

/**
 * INTERNAL/TEST ENDPOINTS ONLY
 * Mounted by app.ts only when NODE_ENV !== 'production' AND
 * ENABLE_INTERNAL_ROUTES=true. Never expose in a deployed environment.
 *
 * Routes:
 * - GET  /health - Health check
 * - POST /verify-user - Get user verification state
 * - POST /get-token - Get verification token for user
 * - POST /verify-token - Check if token exists and is valid
 * - GET  /unverified-users - List unverified users
 * - DELETE /clear-user - Clear test user data
 * - GET  /report - Generate verification report
 * - DELETE /clear-all-test-users - Clear all e2e test users
 */

router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/** POST /internal/verify-user { email: string } */
router.post('/verify-user', async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

/** POST /internal/get-token { userId: number } */
router.post('/get-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'UserId required' });
      return;
    }
    const token = await getActiveVerificationToken(userId);
    if (!token) {
      res.status(404).json({ error: 'No active token found' });
      return;
    }
    res.status(200).json(token);
  } catch (error) {
    next(error);
  }
});

/** POST /internal/verify-token { token: string } */
router.post('/verify-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }
    const valid = await verifyTokenExists(token);
    res.status(200).json({ valid, token });
  } catch (error) {
    next(error);
  }
});

/** GET /internal/unverified-users */
router.get('/unverified-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await getUnverifiedUsers();
    res.status(200).json({ count: users.length, users });
  } catch (error) {
    next(error);
  }
});

/** DELETE /internal/clear-user { email: string } */
router.delete('/clear-user', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }
    const result = await clearUserByEmail(email);
    if (!result) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({
      message: 'User cleared successfully',
      email,
      tokensDeleted: result.tokensDeleted,
    });
  } catch (error) {
    next(error);
  }
});

/** GET /internal/report */
router.get('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json(await generateEmailVerificationReport());
  } catch (error) {
    next(error);
  }
});

/** DELETE /internal/clear-all-test-users */
router.delete('/clear-all-test-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deletedCount = await clearAllE2eTestUsers();
    res.status(200).json({ message: 'Test users cleared successfully', deletedCount });
  } catch (error) {
    next(error);
  }
});

export default router;
