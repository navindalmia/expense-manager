/**
 * Issue #90 (PR #90 review): soft-delete leaks and attach guards for
 * Themes/Labels.
 *  A. usage/totals counted deactivated groups
 *  B. title suggestions surfaced expenses from deactivated groups
 *  C. a disabled theme/label could be attached (create / change on update)
 *  F. renaming onto the user's own DISABLED row created a duplicate
 */

import * as expenseService from '../../services/expenseService';
import * as themeService from '../../services/themeService';
import * as labelService from '../../services/labelService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');
jest.mock('../../utils/cleanData', () => ({ cleanData: (data: unknown) => data }));

const USER_ID = 1;
const ACTIVE_GROUP_FILTER = expect.objectContaining({ isActive: true });

describe('issue #90: soft-delete and attach guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
    (prisma.theme.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.label.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.group.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.expense.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('A. deactivated groups excluded from usage and totals', () => {
    it('should only count active groups in getThemeUsage', async () => {
      await themeService.getThemeUsage(USER_ID);

      expect(prisma.group.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: ACTIVE_GROUP_FILTER }));
      expect(prisma.group.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: ACTIVE_GROUP_FILTER }));
    });

    it('should only total spend from active groups in getLabelTotals', async () => {
      (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 11 }, { id: 12 }]);
      (prisma.label.findMany as jest.Mock).mockResolvedValue([{ id: 3 }]);

      await labelService.getLabelTotals(USER_ID);

      expect(prisma.group.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: ACTIVE_GROUP_FILTER }));
      const where = (prisma.expense.groupBy as jest.Mock).mock.calls[0][0].where;
      expect(where.groupId).toEqual({ in: [11, 12] });
    });
  });

  describe('B. findSimilarExpenses', () => {
    it('should query only active groups so a deactivated group never contributes suggestions', async () => {
      await expenseService.findSimilarExpenses(USER_ID, 'Fuel');

      expect(prisma.group.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: ACTIVE_GROUP_FILTER }));
    });
  });

  describe('C. attaching a disabled theme/label', () => {
    const baseCreate = {
      title: 'Fuel',
      amount: 50,
      paidById: USER_ID,
      categoryId: 1,
      groupId: 1,
      expenseDate: new Date().toISOString(),
    };

    beforeEach(() => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        createdById: USER_ID,
        members: [{ id: USER_ID }],
      });
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
      (prisma.currency.findUnique as jest.Mock).mockResolvedValue({ id: 1, code: 'GBP' });
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });
      (prisma.expense.update as jest.Mock).mockResolvedValue({ id: 1 });
      (prisma.expense.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        amount: 100,
        splitType: 'EQUAL',
        splitAmount: [],
        splitPercentage: [],
        themeId: 4,
        labelId: 7,
        group: { id: 1, createdById: USER_ID, members: [{ id: USER_ID }] },
        splitWith: [{ id: USER_ID }],
      });
    });

    it('should reject creating an expense with a disabled theme', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 4, userId: USER_ID, isActive: false });

      await expect(expenseService.createExpense({ ...baseCreate, themeId: 4 })).rejects.toThrow('THEME.NOT_FOUND');
      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('should reject creating an expense with a disabled label', async () => {
      (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 7, userId: USER_ID, isActive: false });

      await expect(expenseService.createExpense({ ...baseCreate, labelId: 7 })).rejects.toThrow('LABEL.NOT_FOUND');
    });

    it('should reject changing an expense to a different disabled theme or label', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: USER_ID, isActive: false });
      (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 8, userId: USER_ID, isActive: false });

      await expect(expenseService.updateExpense(1, USER_ID, { themeId: 5 })).rejects.toThrow('THEME.NOT_FOUND');
      await expect(expenseService.updateExpense(1, USER_ID, { labelId: 8 })).rejects.toThrow('LABEL.NOT_FOUND');
      expect(prisma.expense.update).not.toHaveBeenCalled();
    });

    it('should allow an update that resubmits the expense\'s existing (now disabled) theme and label', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 4, userId: USER_ID, isActive: false });
      (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 7, userId: USER_ID, isActive: false });

      await expenseService.updateExpense(1, USER_ID, { themeId: 4, labelId: 7, title: 'Renamed' });

      expect(prisma.expense.update).toHaveBeenCalled();
    });

    it('should still reject a different theme owned by another user on update', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: 99, isActive: true });

      await expect(expenseService.updateExpense(1, USER_ID, { themeId: 5 })).rejects.toThrow('THEME.NOT_FOUND');
    });

    it('should disconnect the theme when themeId is null', async () => {
      await expenseService.updateExpense(1, USER_ID, { themeId: null });

      const args = (prisma.expense.update as jest.Mock).mock.calls[0][0];
      expect(args.data.theme).toEqual({ disconnect: true });
    });
  });

  describe('F. rename onto the user\'s own disabled row', () => {
    it('should check collisions against disabled rows of the same user (theme)', async () => {
      (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: USER_ID });
      (prisma.theme.findFirst as jest.Mock).mockResolvedValue({ id: 2, name: 'Old', isActive: false, userId: USER_ID });

      await expect(themeService.renameTheme(USER_ID, 1, 'old')).rejects.toMatchObject({ statusCode: 409 });

      const where = (prisma.theme.findFirst as jest.Mock).mock.calls[0][0].where;
      expect(where.id).toEqual({ not: 1 });
      expect(where.isActive).toBeUndefined();
      expect(where.OR).toContainEqual({ userId: USER_ID });
      expect(where.OR).toContainEqual({ userId: null, isActive: true });
    });

    it('should check collisions against disabled rows of the same user (label)', async () => {
      (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: USER_ID });
      (prisma.label.findFirst as jest.Mock).mockResolvedValue({ id: 2, name: 'Old', isActive: false, userId: USER_ID });

      await expect(labelService.renameLabel(USER_ID, 1, 'old')).rejects.toMatchObject({ statusCode: 409 });

      const where = (prisma.label.findFirst as jest.Mock).mock.calls[0][0].where;
      expect(where.isActive).toBeUndefined();
      expect(where.OR).toContainEqual({ userId: USER_ID });
      expect(where.OR).toContainEqual({ userId: null, isActive: true });
    });
  });
});
