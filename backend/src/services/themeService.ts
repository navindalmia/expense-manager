/**
 * Theme Service
 *
 * Business logic for Themes: reusable, editable group-level master data
 * that links groups across time (e.g. "Monthly Expense" reused every
 * month). Mirrors categoryService.ts's ownership model exactly (KTD7).
 */

import prisma from '../lib/prisma';
import { AppError } from '../errors/AppError';

export async function listThemes(userId: number) {
  return prisma.theme.findMany({
    where: {
      isActive: true,
      OR: [{ userId: null }, { userId }],
    },
    orderBy: { name: 'asc' },
  });
}

export async function createTheme(userId: number, name: string) {
  return prisma.theme.create({
    data: { name, userId, isActive: true },
  });
}

export async function renameTheme(userId: number, themeId: number, name: string) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });

  if (!theme) {
    throw new AppError('THEME.NOT_FOUND', 404, 'THEME_NOT_FOUND', { themeId });
  }

  if (theme.userId !== userId) {
    throw new AppError('THEME.NOT_OWNER', 403, 'THEME_NOT_OWNER', { themeId });
  }

  return prisma.theme.update({
    where: { id: themeId },
    data: { name },
  });
}

export async function disableTheme(userId: number, themeId: number) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });

  if (!theme) {
    throw new AppError('THEME.NOT_FOUND', 404, 'THEME_NOT_FOUND', { themeId });
  }

  if (theme.userId !== userId) {
    throw new AppError('THEME.NOT_OWNER', 403, 'THEME_NOT_OWNER', { themeId });
  }

  if (!theme.isActive) {
    throw new AppError('THEME.ALREADY_DISABLED', 409, 'THEME_ALREADY_DISABLED', { themeId });
  }

  return prisma.theme.update({
    where: { id: themeId },
    data: { isActive: false },
  });
}

/**
 * Validate that a themeId (from a group create/update request) resolves
 * to a theme the given user can see -- global (userId null) or their
 * own. Used by groupService so the visibility rule lives in one place.
 */
export async function assertThemeVisible(userId: number, themeId: number): Promise<void> {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });

  if (!theme || (theme.userId !== null && theme.userId !== userId)) {
    throw new AppError('THEME.NOT_FOUND', 404, 'THEME_NOT_FOUND', { themeId });
  }
}
