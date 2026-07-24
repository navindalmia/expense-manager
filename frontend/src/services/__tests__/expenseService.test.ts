/**
 * Expense Service Tests
 *
 * Validates the ExpenseService API wrapper functions against a mocked
 * `http` client (the shared axios instance in src/api/http), exercising
 * the real exported service functions rather than the http client directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getExpenses, createExpense } from '../expenseService';
import { http } from '../../api/http';

vi.mock('../../api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('ExpenseService API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getExpenses', () => {
    it('should fetch expenses via http.get', async () => {
      const mockExpenses = [
        { id: 1, title: 'Dinner', amount: 50 },
        { id: 2, title: 'Movie', amount: 20 },
      ];

      (http.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockExpenses });

      const result = await getExpenses();

      expect(result).toEqual(mockExpenses);
      expect(http.get).toHaveBeenCalledWith('/expenses');
    });

    it('should propagate rejection when http.get fails', async () => {
      const error = new Error('Network error');
      (http.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getExpenses()).rejects.toThrow('Network error');
    });
  });

  describe('createExpense', () => {
    const expenseData = {
      title: 'Team dinner',
      amount: 50,
      paidById: 1,
      categoryId: 1,
      expenseDate: '2026-04-11T12:00:00Z',
    };

    it('should post expense data and return the created expense', async () => {
      const mockCreated = { id: 1, ...expenseData };
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockCreated });

      const result = await createExpense(expenseData);

      expect(http.post).toHaveBeenCalledWith('/expenses', expenseData);
      expect(result).toEqual(mockCreated);
    });

    it('should propagate rejection when http.post fails', async () => {
      const error = new Error('Validation failed');
      (http.post as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(createExpense(expenseData)).rejects.toThrow('Validation failed');
    });
  });
});
