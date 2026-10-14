/**
 * Label Routes
 *
 * All routes protected with JWT authentication (mirrors
 * groupRoutes.ts/expenseRoutes.ts) -- getLabelTotals returns financial
 * data, so this must not repeat the pre-existing unauthenticated-route
 * gap found and fixed in categoryRoutes.ts (U2).
 */

import { Router } from 'express';
import * as labelController from '../controllers/labelController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, labelController.getLabels);
router.get('/totals', authMiddleware, labelController.getLabelTotals);
router.post('/', authMiddleware, labelController.createLabel);
router.patch('/:id', authMiddleware, labelController.renameLabel);
router.patch('/:id/disable', authMiddleware, labelController.disableLabel);
router.patch('/:id/enable', authMiddleware, labelController.enableLabel);

export default router;
