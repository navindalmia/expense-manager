/**
 * Group Validation Schema
 * 
 * Zod schemas for group creation and updates.
 * Ensures type safety and validation across the API.
 */

import { z } from 'zod';

/**
 * Schema for creating a new group
 */
export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Group name is required')
    .max(100, 'Group name must be less than 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional(),
  currency: z
    .enum(['GBP', 'INR', 'USD', 'EUR', 'AUD', 'CAD', 'JPY', 'CNY', 'OTHER'])
    .optional()
    .default('GBP'),
});

/**
 * Type for group creation request
 */
export type CreateGroupRequest = z.infer<typeof createGroupSchema>;

/**
 * Validates group input data
 * @param data Input data to validate
 * @returns Validated group data
 * @throws ZodError if validation fails
 */
export function validateGroupInput(data: unknown): CreateGroupRequest {
  return createGroupSchema.parse(data);
}
