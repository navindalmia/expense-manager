/**
 * Category Routes
 * 
 * Provides endpoints for fetching and creating expense categories.
 * Categories are stored in database (source of truth).
 * 
 * Endpoints:
 * - GET /api/categories - List all categories
 * - POST /api/categories - Create new category
 */

import { Router } from 'express';
import * as categoryController from '../controllers/categoryController';

const router = Router();

/**
 * GET /api/categories
 * 
 * Returns list of all available expense categories.
 * No authentication required (public data).
 * 
 * Response: { statusCode: 200, data: Category[] }
 */
router.get('/', categoryController.getCategories);

/**
 * POST /api/categories
 * 
 * Create a new expense category in database.
 * Used by users to add custom categories.
 * 
 * Request body: { "code": "CUSTOM", "label": "Custom Category" }
 */
router.post('/', categoryController.createCategory);

export default router;
