/**
 * Category Routes
 *
 * Endpoints for listing and managing expense categories.
 * All routes are protected with JWT authentication -- listing and
 * creating a custom category both require req.user.id to apply the
 * ownership model (system categories are userId=null, custom ones are
 * scoped to their creator). Previously these routes had no auth
 * middleware at all; fixed as part of the intelligence-layer plan (U2).
 *
 * Endpoints:
 * - GET /api/categories - List system + own custom categories
 * - POST /api/categories - Create a custom category
 * - PATCH /api/categories/:id/disable - Disable a custom category you own
 */

import { Router } from 'express';
import * as categoryController from '../controllers/categoryController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, categoryController.getCategories);
router.post('/', authMiddleware, categoryController.createCategory);
router.patch('/:id/disable', authMiddleware, categoryController.disableCategory);

export default router;
