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

export interface ThemeUsage extends Theme {
  groupCount: number;
  expenseCount: number;
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

/**
 * Re-enable a previously disabled custom theme the current user owns.
 *
 * PATCH /api/themes/:id/enable
 */
export async function enableTheme(themeId: number): Promise<Theme> {
  const response = await http.patch<{ statusCode: number; data: Theme }>(`/themes/${themeId}/enable`);
  return response.data.data;
}

/**
 * Rename a custom theme the current user owns.
 *
 * PATCH /api/themes/:id
 */
export async function renameTheme(themeId: number, name: string): Promise<Theme> {
  const response = await http.patch<{ statusCode: number; data: Theme }>(`/themes/${themeId}`, { name });
  return response.data.data;
}

/**
 * Fetch themes with group/expense usage counts for the Manage Themes screen.
 * `includeDisabled` also returns the user's own disabled themes (isActive=false).
 *
 * GET /api/themes/usage[?includeDisabled=true]
 */
export async function getThemeUsage(options: { includeDisabled?: boolean } = {}): Promise<ThemeUsage[]> {
  const response = await http.get<{ statusCode: number; data: ThemeUsage[] }>('/themes/usage', {
    params: options.includeDisabled ? { includeDisabled: 'true' } : undefined,
  });
  return response.data.data;
}
