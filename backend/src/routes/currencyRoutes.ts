/**
 * Currency Routes
 * 
 * Provides endpoints for fetching available currencies.
 * Currencies are stored in database (source of truth).
 * 
 * Endpoints:
 * - GET /api/currencies - List all supported currencies
 * - POST /api/currencies - Create new currency (authenticated; no admin role exists yet)
 */

import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import * as currencyController from '../controllers/currencyController';

const router = Router();

/**
 * GET /api/currencies
 * 
 * Returns list of all supported currencies from database.
 * No authentication required (public data).
 * 
 * Response: { statusCode: 200, data: Currency[] }
 */
router.get('/', currencyController.getCurrencies);

/**
 * POST /api/currencies
 * 
 * Create a new currency in database.
 * Requires a valid JWT. There is no admin role in the schema yet; restrict to
 * admins when one is introduced. No client currently calls this endpoint.
 */
router.post('/', authMiddleware, currencyController.createCurrency);

export default router;
