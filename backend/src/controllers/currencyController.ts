/**
 * Currency Controller
 * 
 * Handles currency-related endpoints.
 * Fetches currencies from database (single source of truth).
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * GET /api/currencies
 * 
 * Fetch all available currencies from database.
 * Returns ordered list of currencies sorted by code.
 * 
 * No authentication required (public data).
 * 
 * Response:
 * {
 *   "statusCode": 200,
 *   "data": [
 *     { "id": 1, "code": "GBP", "label": "British Pound" },
 *     { "id": 2, "code": "USD", "label": "US Dollar" },
 *     ...
 *   ]
 * }
 */
export async function getCurrencies(req: Request, res: Response): Promise<void> {
  try {
    const currencies = await prisma.currency.findMany({
      orderBy: { code: 'asc' },
    });

    logger.info('Currencies fetched successfully', {
      action: 'getCurrencies',
      count: currencies.length,
    });

    res.status(200).json({
      statusCode: 200,
      data: currencies,
    });
  } catch (error) {
    logger.error('Failed to fetch currencies', error, {
      action: 'getCurrencies',
    });

    res.status(500).json({
      statusCode: 500,
      error: 'Failed to fetch currencies',
    });
  }
}

/**
 * POST /api/currencies
 * 
 * Create a new currency (admin only - future feature).
 * Currently not exposed - reserved for future admin functionality.
 */
export async function createCurrency(req: Request, res: Response): Promise<void> {
  const { code, label } = req.body;

  try {
    if (!code || !label) {
      res.status(400).json({
        statusCode: 400,
        error: 'code and label are required',
      });
      return;
    }

    const currency = await prisma.currency.create({
      data: { code: code.toUpperCase(), label },
    });

    logger.info('Currency created successfully', {
      action: 'createCurrency',
      currencyId: currency.id,
      code: currency.code,
    });

    res.status(201).json({
      statusCode: 201,
      data: currency,
    });
  } catch (error) {
    logger.error('Failed to create currency', error, {
      action: 'createCurrency',
    });

    res.status(500).json({
      statusCode: 500,
      error: 'Failed to create currency',
    });
  }
}
