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
  // No hardcoded currency enum here: the Currency table is the single
  // source of truth (see issues #50/#51 -- this field used to duplicate
  // that list with its own, independently-drifted set of codes).
  // groupService.createGroup's DB lookup rejects an unknown code with a
  // proper CURRENCY_NOT_FOUND error, the same way updateGroup already
  // does.
  currency: z
    .string()
    .trim()
    .length(3, 'Currency code must be a 3-letter ISO code')
    .optional()
    .default('GBP'),
  themeId: z.number().int().positive().optional(),
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

/**
 * Schema for adding a member by email
 */
export const addMemberSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .trim()
    .toLowerCase(),
});

/**
 * Type for add member request
 */
export type AddMemberRequest = z.infer<typeof addMemberSchema>;
