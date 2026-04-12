/**
 * Category Controller
 * 
 * Handles category-related endpoints.
 * Fetches categories from database (single source of truth).
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * GET /api/categories
 * 
 * Fetch all available expense categories from database.
 * Returns ordered list of categories sorted by label.
 * 
 * No authentication required (public data).
 * 
 * Response:
 * {
 *   "statusCode": 200,
 *   "data": [
 *     { "id": 1, "code": "FOOD", "label": "Food" },
 *     { "id": 2, "code": "TRAVEL", "label": "Travel" },
 *     ...
 *   ]
 * }
 */
export async function getCategories(req: Request, res: Response): Promise<void> {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { label: 'asc' },
    });

    logger.info('Categories fetched successfully', {
      action: 'getCategories',
      count: categories.length,
    });

    res.status(200).json({
      statusCode: 200,
      data: categories,
    });
  } catch (error) {
    logger.error('Failed to fetch categories', error, {
      action: 'getCategories',
    });

    res.status(500).json({
      statusCode: 500,
      error: 'Failed to fetch categories',
    });
  }
}

/**
 * POST /api/categories
 * 
 * Create a new expense category in database.
 * Used by admin or users to add custom categories.
 * 
 * Request body:
 * {
 *   "code": "CUSTOM_CAT",
 *   "label": "Custom Category"
 * }
 */
export async function createCategory(req: Request, res: Response): Promise<void> {
  const { code, label } = req.body;

  try {
    if (!code || !label) {
      res.status(400).json({
        statusCode: 400,
        error: 'code and label are required',
      });
      return;
    }

    const category = await prisma.category.create({
      data: {
        code: code.toUpperCase(),
        label,
      },
    });

    logger.info('Category created successfully', {
      action: 'createCategory',
      categoryId: category.id,
      code: category.code,
    });

    res.status(201).json({
      statusCode: 201,
      data: category,
    });
  } catch (error: any) {
    // Handle unique constraint violation on code
    if (error.code === 'P2002') {
      logger.warn('Category code already exists', {
        action: 'createCategory',
        code,
      });

      res.status(409).json({
        statusCode: 409,
        error: 'Category with this code already exists',
      });
      return;
    }

    logger.error('Failed to create category', error, {
      action: 'createCategory',
    });

    res.status(500).json({
      statusCode: 500,
      error: 'Failed to create category',
    });
  }
}
