/**
 * Label Service
 *
 * Business logic for Labels: free-text, cross-group expense tags. Same
 * ownership model as categoryService.ts/themeService.ts (KTD7), plus
 * getLabelTotals for the Manage Labels screen (R4).
 */

import prisma from '../lib/prisma';
import { AppError } from '../errors/AppError';

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
  return prisma.label.create({
    data: { name, userId, isActive: true },
  });
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
    where: { OR: [{ userId: null }, { userId }] },
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
