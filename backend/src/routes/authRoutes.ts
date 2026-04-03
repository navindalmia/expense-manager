/**
 * Authentication Routes
 * 
 * Routes for user signup, login, logout, and auth operations
 */

import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

/**
 * User signup / registration
 * POST /api/auth/signup
 * Body: { email, password, name }
 */
router.post('/signup', authController.signup);

/**
 * User login with email and password
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', authController.login);

/**
 * Get current authenticated user
 * GET /api/auth/me
 * Protected: Requires valid JWT token
 */
router.get('/me', authMiddleware, authController.getCurrentUser);

/**
 * User logout
 * POST /api/auth/logout
 * Protected: Requires valid JWT token
 */
router.post('/logout', authMiddleware, authController.logout);

export default router;
