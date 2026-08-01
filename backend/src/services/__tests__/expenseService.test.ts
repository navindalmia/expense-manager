/**
 * Expense Service Tests
 * 
 * Validates business logic for expense creation, retrieval, and deletion
 * Security: Tests user isolation, validation, and authorization
 */

import * as expenseService from '../expenseService';
import prisma from '../../lib/prisma';
import { Currency, SplitType } from '@prisma/client';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');
jest.mock('../../utils/cleanData', () => ({
  cleanData: (data: any) => data,
}));

describe('ExpenseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock group with members for tests
    (prisma.group.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      name: 'Test Group',
      createdById: 1,
      members: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
        { id: 5, name: 'Eve' },
      ],
    });

    // createExpense verifies category and currency exist before writing
    (prisma.category.findUnique as jest.Mock).mockImplementation(
      ({ where }: { where: { id: number } }) =>
        Promise.resolve({ id: where.id, code: 'FOOD', label: 'Food' })
    );
    (prisma.currency.findUnique as jest.Mock).mockImplementation(
      ({ where }: { where: { code: string } }) =>
        Promise.resolve({ id: 1, code: where.code, label: where.code })
    );

    // deleteExpense re-fetches the expense to authorize before deleting
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      group: {
        id: 1,
        createdById: 1,
        members: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 5 }],
      },
    });
  });

  // TODO: Update all createExpense tests to include groupId parameter
  describe.skip('createExpense', () => {
    it('should fetch expenses with relationships included', async () => {
      const mockExpenses = [
        { id: 1, title: 'Dinner', amount: 50, currency: 'GBP' },
        { id: 2, title: 'Movie', amount: 20, currency: 'GBP' },
      ];

      (prisma.expense.findMany as jest.Mock).mockResolvedValue(mockExpenses);

      const result = await expenseService.getAllExpenses();

      // ✅ TEST: Service returns data from database
      expect(result).toEqual(mockExpenses);
      
      // ✅ TEST: Service called findMany with correct include structure
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        include: {
          paidBy: true,
          category: true,
          splitWith: true,
        },
      });
    });

    it('should handle empty expense list', async () => {
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);

      const result = await expenseService.getAllExpenses();

      expect(result).toEqual([]);
      expect(prisma.expense.findMany).toHaveBeenCalled();
    });
  });

  describe('createExpense', () => {
    it('should calculate equal split amounts correctly (120 ÷ 2 split members = 60 each; payer is optional in the split)', async () => {
      const mockCreatedExpense = {
        id: 1,
        title: 'Group Dinner',
        amount: 120,
      };

      (prisma.expense.create as jest.Mock).mockResolvedValue(mockCreatedExpense);

      await expenseService.createExpense({
        title: 'Group Dinner',
        amount: 120,
        paidById: 1,
        categoryId: 1,
        groupId: 1,
        splitWithIds: [1, 2],
        splitType: 'EQUAL',
        expenseDate: new Date().toISOString(),
      });

      // ✅ TEST: Service divides only among splitWithIds (payer is optional in the split)
      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 120,
            splitAmount: [60, 60], // 120 / 2 split members
            splitType: 'EQUAL',
          }),
        })
      );
    });

    it('should calculate equal split for 3 split members (90 ÷ 3 = 30 each; payer is optional in the split)', async () => {
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.createExpense({
        title: 'Dinner',
        amount: 90,
        paidById: 1,
        categoryId: 1,
        groupId: 1,
        splitWithIds: [1, 2, 3],
        splitType: 'EQUAL',
        expenseDate: new Date().toISOString(),
      });

      // ✅ TEST: Verified calculation: 90 ÷ 3 split members = 30
      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            splitAmount: [30, 30, 30],
          }),
        })
      );
    });

    it('should split 100 three ways summing to exactly 100, not 99.99 (regression: naive (amount/N).toFixed(2) loses a cent)', async () => {
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.createExpense({
        title: 'Dinner',
        amount: 100,
        paidById: 1,
        categoryId: 1,
        groupId: 1,
        splitWithIds: [1, 2, 3],
        splitType: 'EQUAL',
        expenseDate: new Date().toISOString(),
      });

      const callArgs = (prisma.expense.create as jest.Mock).mock.calls[0][0];
      const splitAmount: number[] = callArgs.data.splitAmount;
      expect(splitAmount.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
      expect(splitAmount).toEqual([33.34, 33.33, 33.33]);
    });

    it('should convert percentages to amounts (30% of 100 = 30, 70% = 70)', async () => {
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.createExpense({
        title: 'Dinner',
        amount: 100,
        paidById: 1,
        categoryId: 1,
        groupId: 1,
        splitWithIds: [1, 2],
        splitType: 'PERCENTAGE',
        splitPercentage: [30, 70], // 30% and 70%
        expenseDate: new Date().toISOString(),
      });

      // ✅ TEST: Service converted percentages to amounts
      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 100,
            splitAmount: [30, 70], // Calculated from [30%, 70%]
            splitType: 'PERCENTAGE',
            splitPercentage: [30, 70],
          }),
        })
      );
    });

    it('should convert percentages to amounts summing to exactly amount (regression: naive independent rounding drifted by several cents)', async () => {
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      // Naive parseFloat(((p/100)*amount).toFixed(2)) per percentage gives
      // 33.31/33.30/33.30 = 99.91, drifting 7 cents from amount=99.98.
      await expenseService.createExpense({
        title: 'Dinner',
        amount: 99.98,
        paidById: 1,
        categoryId: 1,
        groupId: 1,
        splitWithIds: [1, 2, 3],
        splitType: 'PERCENTAGE',
        splitPercentage: [33.34, 33.33, 33.33],
        expenseDate: new Date().toISOString(),
      });

      const callArgs = (prisma.expense.create as jest.Mock).mock.calls[0][0];
      const splitAmount: number[] = callArgs.data.splitAmount;
      expect(splitAmount.reduce((a, b) => a + b, 0)).toBeCloseTo(99.98, 2);
      expect(splitAmount).toEqual([33.33, 33.33, 33.32]);
    });

    it('should convert percentages correctly with decimals (25% of 100 = 25, 75% = 75)', async () => {
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.createExpense({
        title: 'Dinner',
        amount: 100,
        paidById: 1,
        categoryId: 1,
        groupId: 1,
        splitWithIds: [1, 2],
        splitType: 'PERCENTAGE',
        splitPercentage: [25, 75],
        expenseDate: new Date().toISOString(),
      });

      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            splitAmount: [25, 75],
          }),
        })
      );
    });

    it('should accept AMOUNT split type with valid amounts', async () => {
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.createExpense({
        title: 'Dinner',
        amount: 100,
        paidById: 1,
        categoryId: 1,
        groupId: 1,
        splitWithIds: [1, 2],
        splitType: 'AMOUNT',
        splitAmount: [40, 60], // Sum = 100 ✅
        expenseDate: new Date().toISOString(),
      });

      // ✅ TEST: No error thrown, Prisma.create called
      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 100,
            splitAmount: [40, 60],
            splitType: 'AMOUNT',
          }),
        })
      );
    });

    it('should THROW AppError if AMOUNT split sum does not match total (80 ≠ 100)', async () => {
      // ✅ TEST: Error thrown BEFORE Prisma.create called
      await expect(
        expenseService.createExpense({
          title: 'Dinner',
          amount: 100,
          paidById: 1,
          categoryId: 1,
          groupId: 1,
          splitWithIds: [1, 2],
          splitType: 'AMOUNT',
          splitAmount: [40, 40], // Sum = 80, but total = 100 ❌
          expenseDate: new Date().toISOString(),
        })
      ).rejects.toThrow(AppError);

      // ✅ Verify Prisma was NOT called (error caught before DB)
      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('should THROW AppError if AMOUNT split sum exceeds total (120 > 100)', async () => {
      await expect(
        expenseService.createExpense({
          title: 'Dinner',
          amount: 100,
          paidById: 1,
          categoryId: 1,
          groupId: 1,
          splitWithIds: [1, 2],
          splitType: 'AMOUNT',
          splitAmount: [60, 60], // Sum = 120, but total = 100 ❌
          expenseDate: new Date().toISOString(),
        })
      ).rejects.toThrow(AppError);

      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('should THROW AppError if percentages do not sum to 100 (90 < 100)', async () => {
      // ✅ TEST: Error thrown for invalid percentages
      await expect(
        expenseService.createExpense({
          title: 'Dinner',
          amount: 100,
          paidById: 1,
          categoryId: 1,
          groupId: 1,
          splitWithIds: [1, 2],
          splitType: 'PERCENTAGE',
          splitPercentage: [50, 40], // Sum = 90 ❌
          expenseDate: new Date().toISOString(),
        })
      ).rejects.toThrow(AppError);

      // ✅ Verify Prisma was NOT called
      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('should THROW AppError if percentages exceed 100 (110 > 100)', async () => {
      await expect(
        expenseService.createExpense({
          title: 'Dinner',
          amount: 100,
          paidById: 1,
          categoryId: 1,
          groupId: 1,
          splitWithIds: [1, 2],
          splitType: 'PERCENTAGE',
          splitPercentage: [60, 60], // Sum = 120 ❌
          expenseDate: new Date().toISOString(),
        })
      ).rejects.toThrow(AppError);

      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('should THROW AppError for a negative percentage even when the sum is exactly 100 (regression: [150, -50] sums to 100 but is financially nonsensical)', async () => {
      await expect(
        expenseService.createExpense({
          title: 'Dinner',
          amount: 100,
          paidById: 1,
          categoryId: 1,
          groupId: 1,
          splitWithIds: [1, 2],
          splitType: 'PERCENTAGE',
          splitPercentage: [150, -50], // Sum = 100 but member 2 is negative
          expenseDate: new Date().toISOString(),
        })
      ).rejects.toThrow(AppError);

      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('should THROW AppError for a negative AMOUNT split value even when the sum matches the total', async () => {
      await expect(
        expenseService.createExpense({
          title: 'Dinner',
          amount: 100,
          paidById: 1,
          categoryId: 1,
          groupId: 1,
          splitWithIds: [1, 2],
          splitType: 'AMOUNT',
          splitAmount: [150, -50], // Sum = 100 but member 2 is negative
          expenseDate: new Date().toISOString(),
        })
      ).rejects.toThrow(AppError);

      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('should include all expense data in Prisma.create call', async () => {
      const expenseDate = new Date().toISOString();
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.createExpense({
        title: 'Concert Tickets',
        amount: 200,
        currency: 'USD',
        paidById: 5,
        categoryId: 3,
        groupId: 1,
        splitWithIds: [1, 2],
        splitType: 'EQUAL',
        notes: 'Concert with friends',
        expenseDate,
      });

      // ✅ TEST: All fields passed correctly to Prisma (uses connect for relationships)
      const callArgs = (prisma.expense.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.data).toEqual(
        expect.objectContaining({
          title: 'Concert Tickets',
          amount: 200,
          splitType: 'EQUAL',
          splitAmount: [100, 100], // 200 / 2 split members
          notes: 'Concert with friends',
        })
      );
      // Verify relationship connections (currency/category/group are relation
      // connects, not string/id fields, since the schema moved to FK relations)
      expect(callArgs.data.currency).toEqual({ connect: { id: 1 } });
      expect(callArgs.data.group).toEqual({ connect: { id: 1 } });
      expect(callArgs.data.paidBy).toEqual({ connect: { id: 5 } });
      expect(callArgs.data.category).toEqual({ connect: { id: 3 } });
    });
  });

  describe('updateExpense', () => {
    const mockExistingExpense = {
      id: 1,
      amount: 100,
      splitType: SplitType.EQUAL,
      splitAmount: [33.33, 33.33, 33.33],
      splitPercentage: [],
      group: {
        id: 1,
        createdById: 1,
        members: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
      splitWith: [{ id: 1 }, { id: 2 }, { id: 3 }],
    };

    beforeEach(() => {
      (prisma.expense.findUnique as jest.Mock).mockResolvedValue(mockExistingExpense);
      (prisma.expense.update as jest.Mock).mockResolvedValue({ id: 1 });
    });

    it('persists the recalculated splitAmount when only the total amount changes (regression: was silently dropped, leaving a stale split in the DB)', async () => {
      await expenseService.updateExpense(1, 1, { amount: 120 });

      const callArgs = (prisma.expense.update as jest.Mock).mock.calls[0][0];
      const splitAmount: number[] = callArgs.data.splitAmount;
      expect(splitAmount).toBeDefined();
      expect(splitAmount.reduce((a, b) => a + b, 0)).toBeCloseTo(120, 2);
    });

    it('persists the recalculated splitAmount when only splitPercentage changes (regression: was a silent no-op)', async () => {
      const percentageExpense = {
        ...mockExistingExpense,
        splitType: SplitType.PERCENTAGE,
        splitAmount: [50, 50],
        splitPercentage: [50, 50],
        splitWith: [{ id: 1 }, { id: 2 }],
      };
      (prisma.expense.findUnique as jest.Mock).mockResolvedValue(percentageExpense);

      await expenseService.updateExpense(1, 1, { splitPercentage: [70, 30] });

      const callArgs = (prisma.expense.update as jest.Mock).mock.calls[0][0];
      expect(callArgs.data.splitPercentage).toEqual([70, 30]);
      expect(callArgs.data.splitAmount).toEqual([70, 30]);
    });

    it('splits 100 three ways summing to exactly 100 on an EQUAL-type update, not 99.99', async () => {
      const threeWayExpense = { ...mockExistingExpense, amount: 100 };
      (prisma.expense.findUnique as jest.Mock).mockResolvedValue(threeWayExpense);

      await expenseService.updateExpense(1, 1, { amount: 100 });

      const callArgs = (prisma.expense.update as jest.Mock).mock.calls[0][0];
      const splitAmount: number[] = callArgs.data.splitAmount;
      expect(splitAmount.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
      expect(splitAmount).toEqual([33.34, 33.33, 33.33]);
    });

    it('converts percentages to amounts summing to exactly finalAmount on a PERCENTAGE-type update (regression: naive independent rounding drifted)', async () => {
      const percentageExpense = {
        ...mockExistingExpense,
        splitType: SplitType.PERCENTAGE,
        splitAmount: [50, 50],
        splitPercentage: [50, 50],
        splitWith: [{ id: 1 }, { id: 2 }, { id: 3 }],
      };
      (prisma.expense.findUnique as jest.Mock).mockResolvedValue(percentageExpense);

      await expenseService.updateExpense(1, 1, {
        amount: 99.98,
        splitPercentage: [33.34, 33.33, 33.33],
      });

      const callArgs = (prisma.expense.update as jest.Mock).mock.calls[0][0];
      const splitAmount: number[] = callArgs.data.splitAmount;
      expect(splitAmount.reduce((a, b) => a + b, 0)).toBeCloseTo(99.98, 2);
      expect(splitAmount).toEqual([33.33, 33.33, 33.32]);
    });

    it('throws for a negative percentage even when the sum is exactly 100 (regression: [150, -50] sums to 100 but is financially nonsensical)', async () => {
      const percentageExpense = {
        ...mockExistingExpense,
        splitType: SplitType.PERCENTAGE,
        splitAmount: [50, 50],
        splitPercentage: [50, 50],
        splitWith: [{ id: 1 }, { id: 2 }],
      };
      (prisma.expense.findUnique as jest.Mock).mockResolvedValue(percentageExpense);

      await expect(
        expenseService.updateExpense(1, 1, { splitPercentage: [150, -50] })
      ).rejects.toThrow(AppError);

      expect(prisma.expense.update).not.toHaveBeenCalled();
    });

    it('throws for a negative AMOUNT split value even when the sum matches the total', async () => {
      const amountExpense = {
        ...mockExistingExpense,
        splitType: SplitType.AMOUNT,
        splitAmount: [50, 50],
        splitWith: [{ id: 1 }, { id: 2 }],
      };
      (prisma.expense.findUnique as jest.Mock).mockResolvedValue(amountExpense);

      await expect(
        expenseService.updateExpense(1, 1, { splitAmount: [150, -50] })
      ).rejects.toThrow(AppError);

      expect(prisma.expense.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteExpense', () => {
    it('should delete expense with correct ID', async () => {
      (prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.deleteExpense(1, 1);

      // ✅ TEST: Prisma.delete called with correct where clause
      expect(prisma.expense.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should delete expense with ID 99', async () => {
      (prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 99 });

      await expenseService.deleteExpense(99, 1);

      // ✅ TEST: Prisma called with correct ID
      expect(prisma.expense.delete).toHaveBeenCalledWith({
        where: { id: 99 },
      });
    });

    it('should call delete only once per request', async () => {
      (prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.deleteExpense(1, 1);

      // ✅ TEST: Ensure no duplicate deletes
      expect(prisma.expense.delete).toHaveBeenCalledTimes(1);
    });
  });
});
