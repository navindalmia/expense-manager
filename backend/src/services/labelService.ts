/**
 * Label Service
 *
 * Business logic for Labels: free-text, cross-group expense tags. Same
 * ownership model as categoryService.ts/themeService.ts (KTD7), plus
 * getLabelTotals for the Manage Labels screen (R4).
 */

import prisma from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { findOrReactivate } from '../lib/masterDataLookup';

export async function listLabels(userId: number) {
  return prisma.label.findMany({
    where: {
      isActive: true,
      OR: [{ userId: null }, { userId }],
    },
    orderBy: { name: 'asc' },
  });
}

export async function createLabel(userId: number, name: string) {
  return findOrReactivate({
    findActiveVisible: () =>
      prisma.label.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, isActive: true, OR: [{ userId: null }, { userId }] },
      }),
    findOwnDisabled: () =>
      prisma.label.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, isActive: false, userId },
      }),
    reactivate: (id: number) => prisma.label.update({ where: { id }, data: { isActive: true } }),
    create: () => prisma.label.create({ data: { name, userId, isActive: true } }),
  });
}

/**
 * Rename a label the user owns. A name colliding (case-insensitive) with a
 * DIFFERENT active label is rejected -- silently succeeding would merge two
 * distinct entities and their already-tagged expenses.
 */
export async function renameLabel(userId: number, labelId: number, name: string) {
  const label = await prisma.label.findUnique({ where: { id: labelId } });

  if (!label) {
    throw new AppError('LABEL.NOT_FOUND', 404, 'LABEL_NOT_FOUND', { labelId });
  }

  if (label.userId !== userId) {
    throw new AppError('LABEL.NOT_OWNER', 403, 'LABEL_NOT_OWNER', { labelId });
  }

  const collision = await prisma.label.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      isActive: true,
      id: { not: labelId },
      OR: [{ userId: null }, { userId }],
    },
  });

  if (collision) {
    throw new AppError('LABEL.NAME_EXISTS', 409, 'LABEL_NAME_EXISTS', { labelId });
  }

  return prisma.label.update({ where: { id: labelId }, data: { name } });
}

export async function disableLabel(userId: number, labelId: number) {
  const label = await prisma.label.findUnique({ where: { id: labelId } });

  if (!label) {
    throw new AppError('LABEL.NOT_FOUND', 404, 'LABEL_NOT_FOUND', { labelId });
  }

  if (label.userId !== userId) {
    throw new AppError('LABEL.NOT_OWNER', 403, 'LABEL_NOT_OWNER', { labelId });
  }

  if (!label.isActive) {
    throw new AppError('LABEL.ALREADY_DISABLED', 409, 'LABEL_ALREADY_DISABLED', { labelId });
  }

  return prisma.label.update({
    where: { id: labelId },
    data: { isActive: false },
  });
}

/**
 * Validate that a labelId (from an expense create/update request)
 * resolves to a label the given user can see -- mirrors
 * themeService.assertThemeVisible.
 */
export async function assertLabelVisible(userId: number, labelId: number): Promise<void> {
  const label = await prisma.label.findUnique({ where: { id: labelId } });

  if (!label || (label.userId !== null && label.userId !== userId)) {
    throw new AppError('LABEL.NOT_FOUND', 404, 'LABEL_NOT_FOUND', { labelId });
  }
}

/**
 * Per-label spend totals (R4, AE4) for the Manage Labels screen.
 *
 * Scoped to labels visible to the user (KTD7), but the SUM itself is
 * additionally scoped to expenses in groups the user is a member of or
 * created -- a label is visible app-wide, but expense amounts under it
 * are still group-scoped private data (see U4's Approach note).
 */
export async function getLabelTotals(userId: number) {
  const visibleLabels = await prisma.label.findMany({
    where: { isActive: true, OR: [{ userId: null }, { userId }] },
    orderBy: { name: 'asc' },
  });

  const accessibleGroups = await prisma.group.findMany({
    where: { OR: [{ createdById: userId }, { members: { some: { id: userId } } }] },
    select: { id: true },
  });
  const accessibleGroupIds = accessibleGroups.map((g) => g.id);

  const totals = await prisma.expense.groupBy({
    by: ['labelId'],
    where: {
      labelId: { in: visibleLabels.map((l) => l.id) },
      groupId: { in: accessibleGroupIds },
    },
    _sum: { amount: true },
  });

  const totalsByLabelId = new Map(totals.map((t) => [t.labelId, t._sum.amount ?? 0]));

  return visibleLabels.map((label) => ({
    ...label,
    total: totalsByLabelId.get(label.id) ?? 0,
  }));
}
