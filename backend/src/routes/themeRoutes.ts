/**
 * Theme Routes
 *
 * All routes protected with JWT authentication (mirrors
 * groupRoutes.ts/expenseRoutes.ts) -- every operation needs req.user.id
 * for the ownership model (KTD7).
 */

import { Router } from 'express';
import * as themeController from '../controllers/themeController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, themeController.getThemes);
router.post('/', authMiddleware, themeController.createTheme);
router.patch('/:id', authMiddleware, themeController.renameTheme);
router.patch('/:id/disable', authMiddleware, themeController.disableTheme);

export default router;
