/**
 * Category Service Tests
 *
 * Covers the extensible-Category ownership model (KTD7): a category is
 * either system/global (userId null, visible to everyone) or a
 * user-owned custom category (visible to everyone for selection, but
 * only disableable by its owner). See
 * docs/plans/2026-08-31-001-feat-intelligence-layer-themes-labels-autocomplete-plan.md
 * Implementation Unit U2.
 */

import * as categoryService from '../categoryService';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');

const OWNER_ID = 1;
const OTHER_USER_ID = 2;

describe('CategoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listCategories', () => {
    it('returns system categories and the caller\'s own custom categories', async () => {
      const categories = [
        { id: 1, code: 'FOOD', label: 'Food', userId: null, isActive: true },
        { id: 8, code: 'CUSTOM_BOOK_CLUB', label: 'Book Club', userId: OWNER_ID, isActive: true },
      ];
      (prisma.category.findMany as jest.Mock).mockResolvedValue(categories);

      const result = await categoryService.listCategories(OWNER_ID);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true, OR: [{ userId: null }, { userId: OWNER_ID }] },
        orderBy: { label: 'asc' },
      });
      expect(result).toEqual(categories);
    });
  });

  describe('createCategory', () => {
    it('generates a unique slugified code and persists it with the caller\'s userId', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.category.create as jest.Mock).mockResolvedValue({
        id: 9,
        code: 'CUSTOM_BOOK_CLUB',
        label: 'Book Club',
        userId: OWNER_ID,
        isActive: true,
      });

      const result = await categoryService.createCategory(OWNER_ID, 'Book Club');

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { code: 'CUSTOM_BOOK_CLUB', label: 'Book Club', userId: OWNER_ID, isActive: true },
      });
      expect(result.userId).toBe(OWNER_ID);
    });

    it('appends a disambiguating suffix when the slugified code collides with an existing one', async () => {
      (prisma.category.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 1, code: 'CUSTOM_BOOK_CLUB' }) // first attempt collides
        .mockResolvedValueOnce(null); // second attempt (with suffix) is free
      (prisma.category.create as jest.Mock).mockResolvedValue({
        id: 9,
        code: 'CUSTOM_BOOK_CLUB_2',
        label: 'Book Club',
        userId: OWNER_ID,
        isActive: true,
      });

      await categoryService.createCategory(OWNER_ID, 'Book Club');

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { code: 'CUSTOM_BOOK_CLUB_2', label: 'Book Club', userId: OWNER_ID, isActive: true },
      });
    });
  });

  describe('disableCategory', () => {
    it('disables a category the caller owns', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 9,
        userId: OWNER_ID,
        isActive: true,
      });
      (prisma.category.update as jest.Mock).mockResolvedValue({
        id: 9,
        userId: OWNER_ID,
        isActive: false,
      });

      const result = await categoryService.disableCategory(OWNER_ID, 9);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('throws AppError when the category does not exist', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(categoryService.disableCategory(OWNER_ID, 999)).rejects.toThrow(AppError);
      await expect(categoryService.disableCategory(OWNER_ID, 999)).rejects.toThrow('CATEGORY.NOT_FOUND');
    });

    it('throws AppError when a different user owns the category', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 9,
        userId: OTHER_USER_ID,
        isActive: true,
      });

      await expect(categoryService.disableCategory(OWNER_ID, 9)).rejects.toThrow(AppError);
      await expect(categoryService.disableCategory(OWNER_ID, 9)).rejects.toThrow('CATEGORY.NOT_OWNER');
    });

    it('throws AppError when the category is a system category (userId null)', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        userId: null,
        isActive: true,
      });

      await expect(categoryService.disableCategory(OWNER_ID, 1)).rejects.toThrow('CATEGORY.NOT_OWNER');
    });

    it('throws AppError when the category is already disabled', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 9,
        userId: OWNER_ID,
        isActive: false,
      });

      await expect(categoryService.disableCategory(OWNER_ID, 9)).rejects.toThrow('CATEGORY.ALREADY_DISABLED');
    });
  });
});
