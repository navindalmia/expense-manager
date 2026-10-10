/**
 * Label Service
 *
 * Service layer for Label management. Mirrors categoryService.ts's shape
 * (KTD7's ownership model), plus getLabelTotals for the Manage Labels
 * screen (U10, R4/R6).
 */

import { http } from '../api/http';

export interface Label {
  id: number;
  name: string;
  userId: number | null;
  isActive: boolean;
}

export interface LabelTotal extends Label {
  total: number;
}

/**
 * Fetch labels visible to the current user (system + own custom).
 *
 * GET /api/labels
 */
export async function getLabels(): Promise<Label[]> {
  const response = await http.get<{ statusCode: number; data: Label[] }>('/labels');
  return response.data.data;
}

/**
 * Create a label owned by the current user.
 *
 * POST /api/labels
 */
export async function createLabel(name: string): Promise<Label> {
  const response = await http.post<{ statusCode: number; data: Label }>('/labels', { name });
  return response.data.data;
}

/**
 * Rename a label the current user owns.
 *
 * PATCH /api/labels/:id
 */
export async function renameLabel(labelId: number, name: string): Promise<Label> {
  const response = await http.patch<{ statusCode: number; data: Label }>(`/labels/${labelId}`, { name });
  return response.data.data;
}

/**
 * Disable (not delete) a label the current user owns.
 *
 * PATCH /api/labels/:id/disable
 */
export async function disableLabel(labelId: number): Promise<Label> {
  const response = await http.patch<{ statusCode: number; data: Label }>(`/labels/${labelId}/disable`);
  return response.data.data;
}

/**
 * Re-enable a previously disabled label the current user owns.
 *
 * PATCH /api/labels/:id/enable
 */
export async function enableLabel(labelId: number): Promise<Label> {
  const response = await http.patch<{ statusCode: number; data: Label }>(`/labels/${labelId}/enable`);
  return response.data.data;
}

/**
 * Fetch per-label spend totals for the Manage Labels screen (U10).
 * `includeDisabled` also returns the user's own disabled labels (isActive=false).
 *
 * GET /api/labels/totals[?includeDisabled=true]
 */
export async function getLabelTotals(options: { includeDisabled?: boolean } = {}): Promise<LabelTotal[]> {
  const response = await http.get<{ statusCode: number; data: LabelTotal[] }>('/labels/totals', {
    params: options.includeDisabled ? { includeDisabled: 'true' } : undefined,
  });
  return response.data.data;
}
