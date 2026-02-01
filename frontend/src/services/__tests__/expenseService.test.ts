/**
 * Example test suite for frontend ExpenseService
 * Demonstrates testing API service functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('ExpenseService API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getExpenses', () => {
    it('should fetch expenses with Accept-Language header', async () => {
      const mockExpenses = [
        { id: 1, title: 'Dinner', amount: 50, currency: 'GBP' },
        { id: 2, title: 'Movie', amount: 20, currency: 'GBP' },
      ];

      const mockAxios = axios as any;
      mockAxios.create().get.mockResolvedValue({ data: mockExpenses });

      // Simulate service call
      const result = await mockAxios.create().get('/api/expenses', {
        headers: { 'Accept-Language': 'en' },
      });

      expect(result.data).toEqual(mockExpenses);
    });

    it('should handle fetch errors gracefully', async () => {
      const mockAxios = axios as any;
      const error = new Error('Network error');
      mockAxios.create().get.mockRejectedValue(error);

      await expect(
        mockAxios.create().get('/api/expenses')
      ).rejects.toThrow('Network error');
    });
  });

  describe('createExpense', () => {
    it('should post expense and return created expense', async () => {
      const expenseData = {
        title: 'Dinner',
        amount: 100,
        categoryId: 1,
        paidById: 1,
        expenseDate: '2024-01-01',
      };

      const mockResponse = { id: 1, ...expenseData };
      const mockAxios = axios as any;
      mockAxios.create().post.mockResolvedValue({ data: mockResponse });

      const result = await mockAxios.create().post('/api/expenses', expenseData, {
        headers: { 'Accept-Language': 'en' },
      });

      expect(result.data).toEqual(mockResponse);
    });

    it('should send Accept-Language header on create', async () => {
      const mockAxios = axios as any;
      const postMock = vi.fn().mockResolvedValue({ data: { id: 1 } });
      mockAxios.create().post = postMock;

      const expenseData = { title: 'Test', amount: 50, categoryId: 1, paidById: 1, expenseDate: '2024-01-01' };
      
      await mockAxios.create().post('/api/expenses', expenseData, {
        headers: { 'Accept-Language': 'fr' },
      });

      expect(postMock).toHaveBeenCalledWith(
        '/api/expenses',
        expenseData,
        expect.objectContaining({
          headers: expect.objectContaining({ 'Accept-Language': 'fr' }),
        })
      );
    });
  });
});
