/**
 * Category Controller Tests
 *
 * Rewritten for the intelligence-layer plan's U2: the controller now
 * derives userId from req.user (JWT, via authMiddleware) and delegates
 * to categoryService instead of calling Prisma directly.
 */

import { Request, Response, NextFunction } from 'express';
import { getCategories, createCategory, disableCategory } from '../categoryController';
import * as categoryService from '../../services/categoryService';
import { AppError } from '../../errors/AppError';

jest.mock('../../services/categoryService');

const USER_ID = 1;

describe('Category Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusCode: number;
  let jsonData: any;

  beforeEach(() => {
    jest.clearAllMocks();
    statusCode = 200;
    jsonData = null;

    req = { body: {}, params: {}, user: { id: USER_ID } as any };
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
    next = jest.fn();
  });

  describe('getCategories', () => {
    it('returns categories visible to the authenticated user', async () => {
      const mockCategories = [
        { id: 1, code: 'FOOD', label: 'Food', userId: null },
        { id: 8, code: 'CUSTOM_BOOK_CLUB', label: 'Book Club', userId: USER_ID },
      ];
      (categoryService.listCategories as jest.Mock).mockResolvedValue(mockCategories);

      await getCategories(req as Request, res as Response, next);

      expect(categoryService.listCategories).toHaveBeenCalledWith(USER_ID);
      expect(statusCode).toBe(200);
      expect(jsonData.data).toEqual(mockCategories);
    });

    it('forwards a service error to next() instead of responding directly', async () => {
      const error = new AppError('GENERAL.INTERNAL_SERVER_ERROR', 500, 'DB_ERROR');
      (categoryService.listCategories as jest.Mock).mockRejectedValue(error);

      await getCategories(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createCategory', () => {
    it('creates a category for the authenticated user and returns 201', async () => {
      req.body = { label: 'Book Club' };
      (categoryService.createCategory as jest.Mock).mockResolvedValue({
        id: 9,
        code: 'CUSTOM_BOOK_CLUB',
        label: 'Book Club',
        userId: USER_ID,
      });

      await createCategory(req as Request, res as Response, next);

      expect(categoryService.createCategory).toHaveBeenCalledWith(USER_ID, 'Book Club');
      expect(statusCode).toBe(201);
      expect(jsonData.data.userId).toBe(USER_ID);
    });

    it('forwards a Zod validation error to next() when label is missing', async () => {
      req.body = {};

      await createCategory(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(categoryService.createCategory).not.toHaveBeenCalled();
    });
  });

  describe('disableCategory', () => {
    it('disables the category and returns 200', async () => {
      req.params = { id: '9' };
      (categoryService.disableCategory as jest.Mock).mockResolvedValue({
        id: 9,
        isActive: false,
      });

      await disableCategory(req as Request, res as Response, next);

      expect(categoryService.disableCategory).toHaveBeenCalledWith(USER_ID, 9);
      expect(statusCode).toBe(200);
      expect(jsonData.data.isActive).toBe(false);
    });

    it('forwards a NOT_OWNER AppError to next() rather than swallowing it', async () => {
      req.params = { id: '9' };
      const error = new AppError('CATEGORY.NOT_OWNER', 403, 'CATEGORY_NOT_OWNER');
      (categoryService.disableCategory as jest.Mock).mockRejectedValue(error);

      await disableCategory(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
