/**
 * Category Controller Tests
 */

import { Request, Response } from 'express';
import { getCategories, createCategory } from '../categoryController';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

describe('Category Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusCode: number;
  let jsonData: any;

  beforeEach(() => {
    jest.clearAllMocks();
    statusCode = 200;
    jsonData = null;

    req = { body: {} };
    res = {
      status: jest.fn().mockImplementation((code: number) => {
        statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((data) => {
        jsonData = data;
        return res;
      }),
    };
  });

  describe('getCategories', () => {
    it('returns categories ordered by label', async () => {
      const mockCategories = [
        { id: 1, code: 'FOOD', label: 'Food' },
        { id: 2, code: 'TRAVEL', label: 'Travel' },
      ];
      (prisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);

      await getCategories(req as Request, res as Response);

      expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { label: 'asc' } });
      expect(statusCode).toBe(200);
      expect(jsonData.data).toEqual(mockCategories);
    });

    it('returns 500 when the database query fails', async () => {
      (prisma.category.findMany as jest.Mock).mockRejectedValue(new Error('DB down'));

      await getCategories(req as Request, res as Response);

      expect(statusCode).toBe(500);
      expect(jsonData.error).toBe('Failed to fetch categories');
    });
  });

  describe('createCategory', () => {
    it('creates a category and returns 201', async () => {
      req.body = { code: 'food', label: 'Food' };
      (prisma.category.create as jest.Mock).mockResolvedValue({ id: 1, code: 'FOOD', label: 'Food' });

      await createCategory(req as Request, res as Response);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { code: 'FOOD', label: 'Food' },
      });
      expect(statusCode).toBe(201);
      expect(jsonData.data.code).toBe('FOOD');
    });

    it('returns 400 when code or label is missing', async () => {
      req.body = { code: 'FOOD' };

      await createCategory(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('returns 409 when the category code already exists', async () => {
      req.body = { code: 'FOOD', label: 'Food' };
      const conflictError: any = new Error('Unique constraint failed');
      conflictError.code = 'P2002';
      (prisma.category.create as jest.Mock).mockRejectedValue(conflictError);

      await createCategory(req as Request, res as Response);

      expect(statusCode).toBe(409);
      expect(jsonData.error).toBe('Category with this code already exists');
    });

    it('returns 500 on an unexpected database error', async () => {
      req.body = { code: 'FOOD', label: 'Food' };
      (prisma.category.create as jest.Mock).mockRejectedValue(new Error('DB down'));

      await createCategory(req as Request, res as Response);

      expect(statusCode).toBe(500);
    });
  });
});
