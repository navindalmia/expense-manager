/**
 * Theme Validation Schema
 *
 * Zod schema for creating/renaming Themes (Group-level, reusable
 * master data -- see docs/plans/2026-08-31-001-feat-intelligence-layer-themes-labels-autocomplete-plan.md).
 */

import { z } from 'zod';

export const themeNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Theme name is required')
    .max(50, 'Theme name must be less than 50 characters'),
});

export type ThemeNameRequest = z.infer<typeof themeNameSchema>;

export function validateThemeNameInput(data: unknown): ThemeNameRequest {
  return themeNameSchema.parse(data);
}

/**
 * Query for the Manage Themes screen: `includeDisabled=true` adds the user's
 * own disabled rows to the list. Defaults to false for every other caller.
 */
export const includeDisabledQuerySchema = z.object({
  includeDisabled: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export function validateIncludeDisabledQuery(data: unknown): boolean {
  return includeDisabledQuerySchema.parse(data).includeDisabled;
}
