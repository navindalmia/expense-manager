/**
 * Theme Service
 *
 * Business logic for Themes: reusable, editable group-level master data
 * that links groups across time (e.g. "Monthly Expense" reused every
 * month). Mirrors categoryService.ts's ownership model exactly (KTD7).
 */

import prisma from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { findOrReactivate } from '../lib/masterDataLookup';

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
  return findOrReactivate({
    findActiveVisible: () =>
      prisma.theme.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, isActive: true, OR: [{ userId: null }, { userId }] },
      }),
    findOwnDisabled: () =>
      prisma.theme.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, isActive: false, userId },
      }),
    reactivate: (id: number) => prisma.theme.update({ where: { id }, data: { isActive: true } }),
    create: () => prisma.theme.create({ data: { name, userId, isActive: true } }),
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

  const collision = await prisma.theme.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      id: { not: themeId },
      // Any other row of this user (active OR disabled -- a disabled row
      // can be reactivated later, creating a duplicate) or an active global.
      OR: [{ userId }, { userId: null, isActive: true }],
    },
  });

  if (collision) {
    throw new AppError('THEME.NAME_EXISTS', 409, 'THEME_NAME_EXISTS', { themeId });
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
export async function assertThemeVisible(
  userId: number,
  themeId: number,
  options: { requireActive?: boolean } = {}
): Promise<void> {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });

  if (
    !theme ||
    (theme.userId !== null && theme.userId !== userId) ||
    (options.requireActive && !theme.isActive)
  ) {
    throw new AppError('THEME.NOT_FOUND', 404, 'THEME_NOT_FOUND', { themeId });
  }
}

/**
 * Per-theme usage counts for the Manage Themes screen (R4): how many of
 * the user's accessible groups and expenses carry each visible, active
 * theme. Counts are scoped to groups the user created or belongs to, so a
 * global theme never leaks other users' usage.
 */
export async function getThemeUsage(userId: number) {
  const visibleThemes = await prisma.theme.findMany({
    where: { isActive: true, OR: [{ userId: null }, { userId }] },
    orderBy: { name: 'asc' },
  });

  const accessibleGroups = await prisma.group.findMany({
    where: { isActive: true, OR: [{ createdById: userId }, { members: { some: { id: userId } } }] },
    select: { id: true },
  });
  const accessibleGroupIds = accessibleGroups.map((g) => g.id);
  const themeIds = visibleThemes.map((t) => t.id);

  const [groupCounts, expenseCounts] = await Promise.all([
    prisma.group.groupBy({
      by: ['themeId'],
      where: { themeId: { in: themeIds }, id: { in: accessibleGroupIds }, isActive: true },
      _count: { _all: true },
    }),
    prisma.expense.groupBy({
      by: ['themeId'],
      where: { themeId: { in: themeIds }, groupId: { in: accessibleGroupIds } },
      _count: { _all: true },
    }),
  ]);

  const groupsByTheme = new Map(groupCounts.map((c) => [c.themeId, c._count._all]));
  const expensesByTheme = new Map(expenseCounts.map((c) => [c.themeId, c._count._all]));

  return visibleThemes.map((theme) => ({
    ...theme,
    groupCount: groupsByTheme.get(theme.id) ?? 0,
    expenseCount: expensesByTheme.get(theme.id) ?? 0,
  }));
}
