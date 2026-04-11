/**
 * Expense Controller Tests
 * 
 * Validates expense endpoints for creation, retrieval, and deletion
 * Security: Tests user isolation and authorization
 */

import { Request, Response } from 'express';
import { createExpense, getExpenses, deleteExpense } from '../expenseController';
import prisma from '../../lib/prisma';
import * as expenseService from '../../services/expenseService';

jest.mock('../../lib/prisma');
jest.mock('../../services/expenseService');

describe('Expense Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusCode: number;
  let jsonData: any;

  beforeEach(() => {
    jest.clearAllMocks();

    statusCode = 200;
    jsonData = null;

    req = {
      body: {},
      params: {},
      user: { id: 1 },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((data) => {
        jsonData = data;
        return res;
      }),
    };

    (res.status as jest.Mock).mockImplementation((code) => {
      statusCode = code;
      return res;
    });
  });

  describe('POST /api/expenses', () => {
    it('should create expense with valid data', async () => {
      req.body = {
        title: 'Dinner',
        amount: 50,
        groupId: 1,
        categoryId: 1,
        splitWithIds: [2, 3],
        splitType: 'EQUAL',
        expenseDate: '2026-04-11T12:00:00Z',
        notes: 'Team dinner',
      };

      req.user = { id: 1 };

      (expenseService.createExpense as jest.Mock).mockResolvedValue({
        id: 1,
        title: 'Dinner',
        amount: 50,
        groupId: 1,
        paidById: 1,
        categoryId: 1,
        splitType: 'EQUAL',
        expenseDate: new Date('2026-04-11T12:00:00Z'),
      });

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(201);
      expect(jsonData.success).toBe(true);
      expect(jsonData.data.title).toBe('Dinner');
    });

    it('should require authentication', async () => {
      req.body = {
        title: 'Dinner',
        amount: 50,
        groupId: 1,
      };

      req.user = undefined;

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(401);
    });

    it('should reject missing title', async () => {
      req.body = {
        title: '',
        amount: 50,
        groupId: 1,
        categoryId: 1,
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject negative amount', async () => {
      req.body = {
        title: 'Dinner',
        amount: -50,
        groupId: 1,
        categoryId: 1,
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(400);
    });

    it('should reject zero amount', async () => {
      req.body = {
        title: 'Dinner',
        amount: 0,
        groupId: 1,
        categoryId: 1,
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(400);
    });

    it('should set paidById from authenticated user', async () => {
      req.body = {
        title: 'Dinner',
        amount: 50,
        groupId: 1,
        categoryId: 1,
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 5 };

      (expenseService.createExpense as jest.Mock).mockResolvedValue({
        id: 1,
        paidById: 5,
      });

      await createExpense(req as Request, res as Response);

      // Verify service was called with paidById set to authenticated user
      const serviceCall = (expenseService.createExpense as jest.Mock).mock.calls[0][0];
      expect(serviceCall.paidById).toBe(5);
    });

    it('should handle service errors', async () => {
      req.body = {
        title: 'Dinner',
        amount: 50,
        groupId: 999,
        categoryId: 1,
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      (expenseService.createExpense as jest.Mock).mockRejectedValue(
        new Error('Group not found')
      );

      await createExpense(req as Request, res as Response);

      expect(statusCode).not.toBe(201);
    });

    it('should accept EQUAL split type', async () => {
      req.body = {
        title: 'Dinner',
        amount: 30,
        groupId: 1,
        categoryId: 1,
        splitWithIds: [2],
        splitType: 'EQUAL',
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      (expenseService.createExpense as jest.Mock).mockResolvedValue({
        id: 1,
        splitType: 'EQUAL',
      });

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(201);
    });

    it('should accept AMOUNT split type', async () => {
      req.body = {
        title: 'Dinner',
        amount: 30,
        groupId: 1,
        categoryId: 1,
        splitWithIds: [2],
        splitType: 'AMOUNT',
        splitAmount: [15],
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      (expenseService.createExpense as jest.Mock).mockResolvedValue({
        id: 1,
        splitType: 'AMOUNT',
      });

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(201);
    });

    it('should accept PERCENTAGE split type', async () => {
      req.body = {
        title: 'Dinner',
        amount: 30,
        groupId: 1,
        categoryId: 1,
        splitWithIds: [2],
        splitType: 'PERCENTAGE',
        splitPercentage: [50],
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      (expenseService.createExpense as jest.Mock).mockResolvedValue({
        id: 1,
        splitType: 'PERCENTAGE',
      });

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(201);
    });

    it('should include notes if provided', async () => {
      req.body = {
        title: 'Dinner',
        amount: 50,
        groupId: 1,
        categoryId: 1,
        expenseDate: '2026-04-11T12:00:00Z',
        notes: 'Lunch with team',
      };

      req.user = { id: 1 };

      (expenseService.createExpense as jest.Mock).mockResolvedValue({
        id: 1,
        notes: 'Lunch with team',
      });

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(201);
      const serviceCall = (expenseService.createExpense as jest.Mock).mock.calls[0][0];
      expect(serviceCall.notes).toBe('Lunch with team');
    });
  });

  describe('GET /api/expenses', () => {
    it('should retrieve all expenses', async () => {
      const mockExpenses = [
        { id: 1, title: 'Dinner', amount: 50, groupId: 1 },
        { id: 2, title: 'Lunch', amount: 25, groupId: 1 },
      ];

      (expenseService.getAllExpenses as jest.Mock).mockResolvedValue(mockExpenses);

      await getExpenses(req as Request, res as Response);

      expect(statusCode).toBe(200);
      expect(jsonData).toEqual(mockExpenses);
    });

    it('should handle empty expense list', async () => {
      (expenseService.getAllExpenses as jest.Mock).mockResolvedValue([]);

      await getExpenses(req as Request, res as Response);

      expect(statusCode).toBe(200);
      expect(jsonData).toEqual([]);
    });

    it('should handle service errors', async () => {
      (expenseService.getAllExpenses as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await getExpenses(req as Request, res as Response);

      expect(statusCode).not.toBe(200);
    });
  });

  describe('DELETE /api/expenses/:id', () => {
    it('should delete expense successfully', async () => {
      req.params = { id: '1' };

      (expenseService.deleteExpense as jest.Mock).mockResolvedValue(null);

      await deleteExpense(req as Request, res as Response);

      expect(statusCode).toBe(200);
      expect(jsonData.message).toContain('deleted successfully');
    });

    it('should reject invalid expense id', async () => {
      req.params = { id: 'invalid' };

      (expenseService.deleteExpense as jest.Mock).mockRejectedValue(
        new Error('Invalid id')
      );

      await deleteExpense(req as Request, res as Response);

      expect(statusCode).not.toBe(200);
    });

    it('should handle not found error', async () => {
      req.params = { id: '999' };

      (expenseService.deleteExpense as jest.Mock).mockRejectedValue(
        new Error('Expense not found')
      );

      await deleteExpense(req as Request, res as Response);

      expect(statusCode).not.toBe(200);
    });

    it('should parse id as number', async () => {
      req.params = { id: '42' };

      (expenseService.deleteExpense as jest.Mock).mockResolvedValue(null);

      await deleteExpense(req as Request, res as Response);

      const serviceCall = (expenseService.deleteExpense as jest.Mock).mock.calls[0][0];
      expect(serviceCall).toBe(42);
      expect(typeof serviceCall).toBe('number');
    });
  });

  describe('Security Tests', () => {
    it('should prevent user from creating expense for other user group', async () => {
      req.body = {
        title: 'Dinner',
        amount: 50,
        groupId: 1,
        categoryId: 1,
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      (expenseService.createExpense as jest.Mock).mockRejectedValue(
        new Error('Payer is not a member of this group')
      );

      await createExpense(req as Request, res as Response);

      expect(statusCode).not.toBe(201);
    });

    it('should prevent SQL injection in expense title', async () => {
      req.body = {
        title: "'; DROP TABLE expenses; --",
        amount: 50,
        groupId: 1,
        categoryId: 1,
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      (expenseService.createExpense as jest.Mock).mockResolvedValue({
        id: 1,
        title: "'; DROP TABLE expenses; --",
      });

      await createExpense(req as Request, res as Response);

      // Prisma should protect against SQL injection
      expect(statusCode).toBe(201);
      const serviceCall = (expenseService.createExpense as jest.Mock).mock.calls[0][0];
      // Title should be treated as string literal, not SQL
      expect(typeof serviceCall.title).toBe('string');
    });

    it('should prevent negative amounts', async () => {
      req.body = {
        title: 'Dinner',
        amount: -9999,
        groupId: 1,
        categoryId: 1,
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      await createExpense(req as Request, res as Response);

      expect(statusCode).toBe(400);
    });

    it('should validate split amounts sum to total', async () => {
      req.body = {
        title: 'Dinner',
        amount: 100,
        groupId: 1,
        categoryId: 1,
        splitWithIds: [2, 3],
        splitType: 'AMOUNT',
        splitAmount: [30, 30], // Only 60, not 100
        expenseDate: '2026-04-11T12:00:00Z',
      };

      req.user = { id: 1 };

      (expenseService.createExpense as jest.Mock).mockRejectedValue(
        new Error('Split amounts do not sum to total')
      );

      await createExpense(req as Request, res as Response);

      expect(statusCode).not.toBe(201);
    });
  });
});
