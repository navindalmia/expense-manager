/**
 * Theme Service Tests
 *
 * Mirrors categoryService.test.ts's ownership-model coverage (KTD7),
 * applied to Themes. See
 * docs/plans/2026-08-31-001-feat-intelligence-layer-themes-labels-autocomplete-plan.md
 * Implementation Unit U3.
 */

import * as themeService from '../themeService';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');

const OWNER_ID = 1;
const OTHER_USER_ID = 2;

describe('ThemeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listThemes', () => {
    it('returns system themes and the caller\'s own themes', async () => {
      const themes = [{ id: 1, name: 'Monthly Expense', userId: OWNER_ID, isActive: true }];
      (prisma.theme.findMany as jest.Mock).mockResolvedValue(themes);

      const result = await themeService.listThemes(OWNER_ID);

      expect(prisma.theme.findMany).toHaveBeenCalledWith({
        where: { isActive: true, OR: [{ userId: null }, { userId: OWNER_ID }] },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(themes);
    });
  });

  describe('createTheme', () => {
    it('creates a theme owned by the caller', async () => {
      (prisma.theme.create as jest.Mock).mockResolvedValue({ id: 1, name: 'Monthly Expense', userId: OWNER_ID });

      await themeService.createTheme(OWNER_ID, 'Monthly Expense');

      expect(prisma.theme.create).toHaveBeenCalledWith({
        data: { name: 'Monthly Expense', userId: OWNER_ID, isActive: true },
      });
    });
  });

  describe('renameTheme', () => {
    it('renames a theme the caller owns', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: OWNER_ID });
      (prisma.theme.update as jest.Mock).mockResolvedValue({ id: 1, name: 'New Name', userId: OWNER_ID });

      const result = await themeService.renameTheme(OWNER_ID, 1, 'New Name');

      expect(prisma.theme.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'New Name' } });
      expect(result.name).toBe('New Name');
    });

    it('throws AppError when a different user owns the theme', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: OTHER_USER_ID });

      await expect(themeService.renameTheme(OWNER_ID, 1, 'New Name')).rejects.toThrow('THEME.NOT_OWNER');
    });
  });

  describe('disableTheme', () => {
    it('disables a theme the caller owns', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: OWNER_ID, isActive: true });
      (prisma.theme.update as jest.Mock).mockResolvedValue({ id: 1, userId: OWNER_ID, isActive: false });

      const result = await themeService.disableTheme(OWNER_ID, 1);

      expect(result.isActive).toBe(false);
    });

    it('throws AppError when the theme does not exist', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(themeService.disableTheme(OWNER_ID, 999)).rejects.toThrow(AppError);
    });

    it('throws AppError when already disabled', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: OWNER_ID, isActive: false });

      await expect(themeService.disableTheme(OWNER_ID, 1)).rejects.toThrow('THEME.ALREADY_DISABLED');
    });
  });

  describe('assertThemeVisible', () => {
    it('resolves without throwing for a global theme (userId null)', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: null });

      await expect(themeService.assertThemeVisible(OWNER_ID, 1)).resolves.toBeUndefined();
    });

    it('resolves without throwing for the caller\'s own theme', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: OWNER_ID });

      await expect(themeService.assertThemeVisible(OWNER_ID, 1)).resolves.toBeUndefined();
    });

    it('throws AppError for a theme owned by a different user', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: OTHER_USER_ID });

      await expect(themeService.assertThemeVisible(OWNER_ID, 1)).rejects.toThrow('THEME.NOT_FOUND');
    });

    it('throws AppError when the theme does not exist', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(themeService.assertThemeVisible(OWNER_ID, 999)).rejects.toThrow('THEME.NOT_FOUND');
    });
  });
});
