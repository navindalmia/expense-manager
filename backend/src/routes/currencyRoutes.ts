/**
 * Currency Routes
 * 
 * Provides endpoints for fetching available currencies.
 * Currencies are stored in database (source of truth).
 * 
 * Endpoints:
 * - GET /api/currencies - List all supported currencies
 * - POST /api/currencies - Create new currency (admin only - future)
 */

import { Router } from 'express';
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
 * POST /api/currencies (Future: Admin only)
 * 
 * Create a new currency in database.
 * Currently reserved for future admin functionality.
 */
router.post('/', currencyController.createCurrency);

export default router;
