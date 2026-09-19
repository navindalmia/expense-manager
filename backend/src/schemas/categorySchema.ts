/**
 * Category Validation Schema
 *
 * Zod schema for user-created custom categories.
 */

import { z } from 'zod';

export const createCategorySchema = z.object({
  label: z
    .string()
    .min(1, 'Category label is required')
    .max(50, 'Category label must be less than 50 characters')
    .trim(),
});

export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;

export function validateCreateCategoryInput(data: unknown): CreateCategoryRequest {
  return createCategorySchema.parse(data);
}
