/**
 * Category Service
 * 
 * Service layer for fetching expense categories from backend.
 * Abstracts HTTP calls to backend /api/categories endpoint.
 * Provides typed interface for category data.
 */

import { http } from '../api/http';

/**
 * Category entity from backend.
 * Categorizes expenses (e.g., FOOD, TRAVEL, ENTERTAINMENT).
 */
export interface Category {
  id: number;
  code: string;
  label: string;
}

/**
 * Fetch all available expense categories from backend.
 * 
 * GET /api/categories
 * 
 * Returns array of all categories that can be assigned to expenses.
 * Used by expense creation/editing forms.
 * 
 * Returns: Category[]
 * Throws: HTTP error if backend is unavailable
 * 
 * Example:
 * const categories = await getCategories();
 * // [
 * //   { id: 1, code: 'FOOD', label: 'Food' },
 * //   { id: 2, code: 'TRAVEL', label: 'Travel' },
 * // ]
 */
export async function getCategories(): Promise<Category[]> {
  const response = await http.get<{ statusCode: number; data: Category[] }>(
    '/categories'
  );
  return response.data.data;
}

/**
 * Create a custom category owned by the current user (KTD7).
 *
 * POST /api/categories
 */
export async function createCategory(label: string): Promise<Category> {
  const response = await http.post<{ statusCode: number; data: Category }>('/categories', { label });
  return response.data.data;
}

/**
 * Disable (not delete) a custom category the current user owns.
 *
 * PATCH /api/categories/:id/disable
 */
export async function disableCategory(categoryId: number): Promise<Category> {
  const response = await http.patch<{ statusCode: number; data: Category }>(
    `/categories/${categoryId}/disable`
  );
  return response.data.data;
}
