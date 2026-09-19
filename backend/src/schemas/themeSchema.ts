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
    .min(1, 'Theme name is required')
    .max(50, 'Theme name must be less than 50 characters')
    .trim(),
});

export type ThemeNameRequest = z.infer<typeof themeNameSchema>;

export function validateThemeNameInput(data: unknown): ThemeNameRequest {
  return themeNameSchema.parse(data);
}
