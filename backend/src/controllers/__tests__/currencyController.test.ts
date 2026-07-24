/**
 * Currency Controller Tests
 */

import { Request, Response } from 'express';
import { getCurrencies, createCurrency } from '../currencyController';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

describe('Currency Controller', () => {
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

  describe('getCurrencies', () => {
    it('returns currencies ordered by code', async () => {
      const mockCurrencies = [
        { id: 1, code: 'GBP', label: 'British Pound' },
        { id: 2, code: 'USD', label: 'US Dollar' },
      ];
      (prisma.currency.findMany as jest.Mock).mockResolvedValue(mockCurrencies);

      await getCurrencies(req as Request, res as Response);

      expect(prisma.currency.findMany).toHaveBeenCalledWith({ orderBy: { code: 'asc' } });
      expect(statusCode).toBe(200);
      expect(jsonData.data).toEqual(mockCurrencies);
    });

    it('returns 500 when the database query fails', async () => {
      (prisma.currency.findMany as jest.Mock).mockRejectedValue(new Error('DB down'));

      await getCurrencies(req as Request, res as Response);

      expect(statusCode).toBe(500);
      expect(jsonData.error).toBe('Failed to fetch currencies');
    });
  });

  describe('createCurrency', () => {
    it('creates a currency and returns 201', async () => {
      req.body = { code: 'usd', label: 'US Dollar' };
      (prisma.currency.create as jest.Mock).mockResolvedValue({ id: 1, code: 'USD', label: 'US Dollar' });

      await createCurrency(req as Request, res as Response);

      expect(prisma.currency.create).toHaveBeenCalledWith({
        data: { code: 'USD', label: 'US Dollar' },
      });
      expect(statusCode).toBe(201);
    });

    it('returns 400 when code or label is missing', async () => {
      req.body = { label: 'US Dollar' };

      await createCurrency(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(prisma.currency.create).not.toHaveBeenCalled();
    });

    it('returns 500 on an unexpected database error', async () => {
      req.body = { code: 'USD', label: 'US Dollar' };
      (prisma.currency.create as jest.Mock).mockRejectedValue(new Error('DB down'));

      await createCurrency(req as Request, res as Response);

      expect(statusCode).toBe(500);
    });
  });
});
