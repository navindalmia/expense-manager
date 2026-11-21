/**
 * Characterization tests (issue #182 wave 2A): pin the behaviour of
 * groupService / expenseService that must NOT change while the group guards,
 * share math, group-expense listing and member removal are consolidated.
 * These pass before and after the refactor.
 */

import * as groupService from '../groupService';
import * as expenseService from '../expenseService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

const CREATOR_ID = 1;
const MEMBER_ID = 2;
const THIRD_ID = 3;
const FOURTH_ID = 4;

interface ShareExpense {
  amount: number;
  paidById: number;
  splitType: 'EQUAL' | 'AMOUNT' | 'PERCENTAGE';
  splitWith: { id: number }[];
  splitAmount: number[] | null;
  splitPercentage: number[] | null;
}

async function personalTotal(expense: ShareExpense, userId: number): Promise<number> {
  (prisma.group.findMany as jest.Mock).mockResolvedValue([
    { id: 1, createdById: CREATOR_ID, members: [{ id: CREATOR_ID }], expenses: [expense] },
  ]);
  const result = await groupService.getUserGroups(userId);
  return result[0]!.userPersonalTotal;
}

describe('groupService characterization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('personal share math where whole-cent division is exact', () => {
    it('should give each EQUAL split member amount / count when the division is exact', async () => {
      const expense: ShareExpense = {
        amount: 100,
        paidById: CREATOR_ID,
        splitType: 'EQUAL',
        splitWith: [{ id: CREATOR_ID }, { id: MEMBER_ID }, { id: THIRD_ID }, { id: FOURTH_ID }],
        splitAmount: null,
        splitPercentage: null,
      };
      expect(await personalTotal(expense, CREATOR_ID)).toBe(25);
      expect(await personalTotal(expense, FOURTH_ID)).toBe(25);
    });

    it('should give a PERCENTAGE member amount * pct / 100 when the result is whole cents', async () => {
      const expense: ShareExpense = {
        amount: 200,
        paidById: CREATOR_ID,
        splitType: 'PERCENTAGE',
        splitWith: [{ id: CREATOR_ID }, { id: MEMBER_ID }],
        splitAmount: null,
        splitPercentage: [25, 75],
      };
      expect(await personalTotal(expense, CREATOR_ID)).toBe(50);
      expect(await personalTotal(expense, MEMBER_ID)).toBe(150);
    });

    it('should give a non-payer their stored AMOUNT share and the payer the remainder', async () => {
      const expense: ShareExpense = {
        amount: 90,
        paidById: CREATOR_ID,
        splitType: 'AMOUNT',
        splitWith: [{ id: MEMBER_ID }, { id: THIRD_ID }],
        splitAmount: [30, 20],
        splitPercentage: null,
      };
      expect(await personalTotal(expense, MEMBER_ID)).toBe(30);
      expect(await personalTotal(expense, CREATOR_ID)).toBe(40);
    });

    it('should charge the payer the full amount when nobody else is in the split', async () => {
      const expense: ShareExpense = {
        amount: 42,
        paidById: CREATOR_ID,
        splitType: 'EQUAL',
        splitWith: [],
        splitAmount: null,
        splitPercentage: null,
      };
      expect(await personalTotal(expense, CREATOR_ID)).toBe(42);
    });

    it('should give 0 to a user who is neither payer nor in the split', async () => {
      const expense: ShareExpense = {
        amount: 60,
        paidById: CREATOR_ID,
        splitType: 'EQUAL',
        splitWith: [{ id: MEMBER_ID }],
        splitAmount: null,
        splitPercentage: null,
      };
      expect(await personalTotal(expense, FOURTH_ID)).toBe(0);
    });
  });

  describe('getGroupStats (currency handling is an open owner decision)', () => {
    const group = { id: 1, isActive: true, createdById: CREATOR_ID, members: [{ id: CREATOR_ID }] };

    it('should report GBP when the group has no unsettled expenses', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(group);
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await groupService.getGroupStats(1, CREATOR_ID);

      expect(stats).toEqual({ totalExpenses: 0, totalAmount: 0, byPayer: {}, currency: 'GBP' });
    });

    it('should add amounts together without converting currencies and report the first expense currency', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(group);
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([
        { amount: 10, paidById: CREATOR_ID, currency: { code: 'USD' }, paidBy: { id: CREATOR_ID, name: 'A' } },
        { amount: 5, paidById: CREATOR_ID, currency: { code: 'EUR' }, paidBy: { id: CREATOR_ID, name: 'A' } },
      ]);

      const stats = await groupService.getGroupStats(1, CREATOR_ID);

      expect(stats.totalAmount).toBe(15);
      expect(stats.byPayer[CREATOR_ID]).toEqual({ name: 'A', amount: 15 });
      expect(stats.currency).toEqual({ code: 'USD' });
    });
  });

  describe('group expense listing query (GET /api/expenses/group/:groupId)', () => {
    it('should fetch unsettled expenses of the group newest first with currency, payer, category and split members', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        isActive: true,
        createdById: CREATOR_ID,
        members: [{ id: MEMBER_ID }],
      });
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([{ id: 9 }]);

      const result = await expenseService.getGroupExpenses(1, MEMBER_ID);

      expect(result).toEqual([{ id: 9 }]);
      const args = (prisma.expense.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where).toEqual({ groupId: 1, isSettled: false });
      expect(args.orderBy).toEqual({ expenseDate: 'desc' });
      expect(Object.keys(args.include).sort()).toEqual(['category', 'currency', 'paidBy', 'splitWith']);
    });

    it('should answer 403 GROUP_UNAUTHORIZED to a user outside the group', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        isActive: true,
        createdById: CREATOR_ID,
        members: [{ id: MEMBER_ID }],
      });

      await expect(expenseService.getGroupExpenses(1, 999)).rejects.toMatchObject({
        statusCode: 403,
        code: 'GROUP_UNAUTHORIZED',
      });
    });
  });

  describe('removeMemberFromGroup ordering', () => {
    it('should settle the removed member expenses before disconnecting the member', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        isActive: true,
        createdById: CREATOR_ID,
        members: [{ id: CREATOR_ID }, { id: MEMBER_ID }],
      });
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([{ id: 10 }]);
      (prisma.group.update as jest.Mock).mockResolvedValue({ members: [] });
      (prisma.$transaction as jest.Mock).mockImplementation(async (arg: unknown) =>
        typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(prisma) : arg
      );

      await groupService.removeMemberFromGroup(1, MEMBER_ID, CREATOR_ID);

      const settle = (prisma.expense.updateMany as jest.Mock).mock.invocationCallOrder[0]!;
      const disconnect = (prisma.group.update as jest.Mock).mock.invocationCallOrder[0]!;
      expect(settle).toBeLessThan(disconnect);
    });
  });
});
