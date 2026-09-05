/**
 * Category Service
 *
 * Business logic for the extensible Category system (intelligence-layer
 * plan U2): the 7 seeded categories remain global (userId = null), and
 * users can add their own custom categories on top. See
 * docs/plans/2026-08-31-001-feat-intelligence-layer-themes-labels-autocomplete-plan.md
 * KTD7 for the ownership model this mirrors across Theme/Label too.
 */

import prisma from '../lib/prisma';
import { AppError } from '../errors/AppError';

/**
 * List categories visible to a user: system/global (userId null) plus
 * their own active custom categories.
 */
export async function listCategories(userId: number) {
  return prisma.category.findMany({
    where: {
      isActive: true,
      OR: [{ userId: null }, { userId }],
    },
    orderBy: { label: 'asc' },
  });
}

/**
 * Slugify a label into a unique category code, retrying with a numeric
 * suffix on collision (the `code` column is @unique).
 */
async function generateUniqueCode(label: string): Promise<string> {
  const base = `CUSTOM_${label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}`;

  let candidate = base;
  let suffix = 1;

  while (await prisma.category.findUnique({ where: { code: candidate } })) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }

  return candidate;
}

/**
 * Create a custom category owned by the given user.
 */
export async function createCategory(userId: number, label: string) {
  const code = await generateUniqueCode(label);

  return prisma.category.create({
    data: {
      code,
      label,
      userId,
      isActive: true,
    },
  });
}

/**
 * Disable (not delete) a category. Only the owning user may disable
 * their own custom category -- system categories (userId null) are not
 * user-disableable in this plan (see Scope Boundaries).
 */
export async function disableCategory(userId: number, categoryId: number) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });

  if (!category) {
    throw new AppError('CATEGORY.NOT_FOUND', 404, 'CATEGORY_NOT_FOUND', { categoryId });
  }

  if (category.userId !== userId) {
    throw new AppError('CATEGORY.NOT_OWNER', 403, 'CATEGORY_NOT_OWNER', { categoryId });
  }

  if (!category.isActive) {
    throw new AppError('CATEGORY.ALREADY_DISABLED', 409, 'CATEGORY_ALREADY_DISABLED', { categoryId });
  }

  return prisma.category.update({
    where: { id: categoryId },
    data: { isActive: false },
  });
}
