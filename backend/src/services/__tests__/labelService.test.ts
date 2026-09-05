/**
 * Label Service Tests
 *
 * Covers the ownership model (KTD7) plus getLabelTotals's dual-scoping
 * rule (R4, AE4, AE5): a label's visibility follows KTD7, but the
 * expense amounts under it stay group-scoped private data even though
 * the label itself is visible app-wide. See
 * docs/plans/2026-08-31-001-feat-intelligence-layer-themes-labels-autocomplete-plan.md
 * Implementation Unit U4.
 */

import * as labelService from '../labelService';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');

const OWNER_ID = 1;
const OTHER_USER_ID = 2;

describe('LabelService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listLabels / createLabel / disableLabel', () => {
    it('lists system and own labels', async () => {
      (prisma.label.findMany as jest.Mock).mockResolvedValue([{ id: 1, name: 'Liverpool' }]);

      await labelService.listLabels(OWNER_ID);

      expect(prisma.label.findMany).toHaveBeenCalledWith({
        where: { isActive: true, OR: [{ userId: null }, { userId: OWNER_ID }] },
        orderBy: { name: 'asc' },
      });
    });

    it('creates a label owned by the caller', async () => {
      (prisma.label.create as jest.Mock).mockResolvedValue({ id: 1, name: 'Liverpool', userId: OWNER_ID });

      await labelService.createLabel(OWNER_ID, 'Liverpool');

      expect(prisma.label.create).toHaveBeenCalledWith({
        data: { name: 'Liverpool', userId: OWNER_ID, isActive: true },
      });
    });

    it('throws AppError disabling a label owned by another user', async () => {
      (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: OTHER_USER_ID, isActive: true });

      await expect(labelService.disableLabel(OWNER_ID, 1)).rejects.toThrow('LABEL.NOT_OWNER');
    });
  });

  describe('assertLabelVisible', () => {
    it('resolves for a label the caller owns', async () => {
      (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: OWNER_ID });

      await expect(labelService.assertLabelVisible(OWNER_ID, 1)).resolves.toBeUndefined();
    });

    it('throws AppError for a label owned by someone else', async () => {
      (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 1, userId: OTHER_USER_ID });

      await expect(labelService.assertLabelVisible(OWNER_ID, 1)).rejects.toThrow('LABEL.NOT_FOUND');
    });
  });

  describe('getLabelTotals', () => {
    it('sums correctly across 3 different groups for one label -- Covers AE4', async () => {
      (prisma.label.findMany as jest.Mock).mockResolvedValue([{ id: 1, name: 'Liverpool', userId: OWNER_ID }]);
      (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 10 }, { id: 20 }, { id: 30 }]);
      (prisma.expense.groupBy as jest.Mock).mockResolvedValue([{ labelId: 1, _sum: { amount: 340 } }]);

      const result = await labelService.getLabelTotals(OWNER_ID);

      expect(prisma.expense.groupBy).toHaveBeenCalledWith({
        by: ['labelId'],
        where: { labelId: { in: [1] }, groupId: { in: [10, 20, 30] } },
        _sum: { amount: true },
      });
      expect(result).toEqual([{ id: 1, name: 'Liverpool', userId: OWNER_ID, total: 340 }]);
    });

    it('returns a 0 total for a label owned but applied to zero expenses', async () => {
      (prisma.label.findMany as jest.Mock).mockResolvedValue([{ id: 2, name: 'Unused', userId: OWNER_ID }]);
      (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 10 }]);
      (prisma.expense.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await labelService.getLabelTotals(OWNER_ID);

      expect(result).toEqual([{ id: 2, name: 'Unused', userId: OWNER_ID, total: 0 }]);
    });

    it('never includes amounts from a group the requesting user is not a member of', async () => {
      (prisma.label.findMany as jest.Mock).mockResolvedValue([{ id: 1, name: 'Liverpool', userId: OWNER_ID }]);
      // Only group 10 is accessible to this user, even though the label
      // might also be used (by someone else with access) in group 99.
      (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 10 }]);
      (prisma.expense.groupBy as jest.Mock).mockResolvedValue([{ labelId: 1, _sum: { amount: 50 } }]);

      await labelService.getLabelTotals(OWNER_ID);

      expect(prisma.expense.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ groupId: { in: [10] } }) })
      );
    });
  });
});
