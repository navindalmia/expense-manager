/**
 * Group Validation Schema
 * 
 * Zod schemas for group creation and updates.
 * Ensures type safety and validation across the API.
 */

import { z } from 'zod';
import { SEED_CURRENCIES } from '../lib/seedCurrencies';

/** Single source of truth: codes seeded in the Currency table (plus legacy OTHER). */
export const ALLOWED_GROUP_CURRENCY_CODES: readonly string[] = [
  ...SEED_CURRENCIES.map((c) => c.code),
  'OTHER',
];

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
    .string()
    .refine((code: string) => ALLOWED_GROUP_CURRENCY_CODES.includes(code), {
      message: 'Unsupported currency code',
    })
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
