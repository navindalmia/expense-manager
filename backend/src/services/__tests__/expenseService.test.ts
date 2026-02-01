/**
 * Unit tests for ExpenseService
 * Tests business logic: split calculations, validations, and error handling
 * Mocks Prisma to isolate service logic from database
 */

import * as expenseService from '../../services/expenseService';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');

describe('ExpenseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllExpenses', () => {
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
    it('should calculate equal split amounts correctly (120 ÷ 2 = 60 each)', async () => {
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
        splitWithIds: [1, 2], // 2 people
        splitType: 'EQUAL',
        expenseDate: new Date().toISOString(),
      });

      // ✅ TEST: Service calculated splitAmount as [60, 60]
      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 120,
            splitAmount: [60, 60], // Service calculated this
            splitType: 'EQUAL',
          }),
        })
      );
    });

    it('should calculate equal split for 3 people (90 ÷ 3 = 30 each)', async () => {
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.createExpense({
        title: 'Dinner',
        amount: 90,
        paidById: 1,
        categoryId: 1,
        splitWithIds: [1, 2, 3], // 3 people
        splitType: 'EQUAL',
        expenseDate: new Date().toISOString(),
      });

      // ✅ TEST: Verified calculation: 90 ÷ 3 = 30
      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            splitAmount: [30, 30, 30],
          }),
        })
      );
    });

    it('should convert percentages to amounts (30% of 100 = 30, 70% = 70)', async () => {
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.createExpense({
        title: 'Dinner',
        amount: 100,
        paidById: 1,
        categoryId: 1,
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

    it('should convert percentages correctly with decimals (25% of 100 = 25, 75% = 75)', async () => {
      (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.createExpense({
        title: 'Dinner',
        amount: 100,
        paidById: 1,
        categoryId: 1,
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
          splitWithIds: [1, 2],
          splitType: 'PERCENTAGE',
          splitPercentage: [60, 60], // Sum = 120 ❌
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
        splitWithIds: [1, 2],
        splitType: 'EQUAL',
        notes: 'Concert with friends',
        expenseDate,
      });

      // ✅ TEST: All fields passed correctly to Prisma
      expect(prisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Concert Tickets',
            amount: 200,
            currency: 'USD',
            paidById: 5,
            categoryId: 3,
            splitType: 'EQUAL',
            splitAmount: [100, 100],
            notes: 'Concert with friends',
          }),
        })
      );
    });
  });

  describe('deleteExpense', () => {
    it('should delete expense with correct ID', async () => {
      (prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.deleteExpense(1);

      // ✅ TEST: Prisma.delete called with correct where clause
      expect(prisma.expense.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should delete expense with ID 99', async () => {
      (prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 99 });

      await expenseService.deleteExpense(99);

      // ✅ TEST: Prisma called with correct ID
      expect(prisma.expense.delete).toHaveBeenCalledWith({
        where: { id: 99 },
      });
    });

    it('should call delete only once per request', async () => {
      (prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 1 });

      await expenseService.deleteExpense(1);

      // ✅ TEST: Ensure no duplicate deletes
      expect(prisma.expense.delete).toHaveBeenCalledTimes(1);
    });
  });
});
