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
    .min(1, 'Label name is required')
    .max(50, 'Label name must be less than 50 characters')
    .trim(),
});

export type LabelNameRequest = z.infer<typeof labelNameSchema>;

export function validateLabelNameInput(data: unknown): LabelNameRequest {
  return labelNameSchema.parse(data);
}
