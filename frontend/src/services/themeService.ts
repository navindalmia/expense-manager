/**
 * Theme Service
 *
 * Service layer for Theme management. Mirrors categoryService.ts's shape
 * (KTD7's ownership model: system/global themes are userId=null, custom
 * ones belong to their creator).
 */

import { http } from '../api/http';

export interface Theme {
  id: number;
  name: string;
  userId: number | null;
  isActive: boolean;
}

/**
 * Fetch themes visible to the current user (system + own custom).
 *
 * GET /api/themes
 */
export async function getThemes(): Promise<Theme[]> {
  const response = await http.get<{ statusCode: number; data: Theme[] }>('/themes');
  return response.data.data;
}

/**
 * Create a custom theme owned by the current user.
 *
 * POST /api/themes
 */
export async function createTheme(name: string): Promise<Theme> {
  const response = await http.post<{ statusCode: number; data: Theme }>('/themes', { name });
  return response.data.data;
}

/**
 * Disable (not delete) a custom theme the current user owns.
 *
 * PATCH /api/themes/:id/disable
 */
export async function disableTheme(themeId: number): Promise<Theme> {
  const response = await http.patch<{ statusCode: number; data: Theme }>(`/themes/${themeId}/disable`);
  return response.data.data;
}
