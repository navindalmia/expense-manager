/**
 * Category Controller
 *
 * HTTP handlers for category listing and custom-category management.
 * Validates input via Zod, calls the service layer, returns JSON.
 */

import { Request, Response, NextFunction } from 'express';
import * as categoryService from '../services/categoryService';
import { validateCreateCategoryInput } from '../schemas/categorySchema';

/**
 * GET /api/categories
 *
 * Returns the 7 seeded system categories plus the caller's own active
 * custom categories.
 */
export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categories = await categoryService.listCategories(userId);

    res.status(200).json({
      statusCode: 200,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/categories
 *
 * Create a custom category owned by the calling user.
 */
export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = validateCreateCategoryInput(req.body);
    const userId = req.user!.id;

    const category = await categoryService.createCategory(userId, validated.label);

    res.status(201).json({
      statusCode: 201,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/categories/:id/disable
 *
 * Disable (not delete) a custom category the calling user owns.
 */
export async function disableCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categoryId = Number(req.params.id);

    const category = await categoryService.disableCategory(userId, categoryId);

    res.status(200).json({
      statusCode: 200,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}
