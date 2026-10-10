/**
 * Label Validation Schema
 *
 * Zod schema for creating/renaming Labels (free-text, cross-group
 * expense tags -- see docs/plans/2026-08-31-001-feat-intelligence-layer-themes-labels-autocomplete-plan.md).
 */

import { z } from 'zod';

export const labelNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Label name is required')
    .max(50, 'Label name must be less than 50 characters'),
});

export type LabelNameRequest = z.infer<typeof labelNameSchema>;

export function validateLabelNameInput(data: unknown): LabelNameRequest {
  return labelNameSchema.parse(data);
}

/**
 * Query for the Manage Labels screen: `includeDisabled=true` adds the user's
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

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** Parse and validate the numeric :id route param (throws ZodError -> 400). */
export function validateIdParam(params: unknown): number {
  return idParamSchema.parse(params).id;
}
