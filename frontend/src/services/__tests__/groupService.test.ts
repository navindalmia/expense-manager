/**
 * Group Service Tests
 *
 * Validates the GroupService API wrapper functions against a mocked
 * `http` client (the shared axios instance in src/api/http), exercising
 * the real exported service functions rather than the http client directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGroups } from '../groupService';
import { http } from '../../api/http';

vi.mock('../../api/http', () => ({
  http: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('GroupService API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGroups', () => {
    it('should return the unwrapped groups array, not the response envelope', async () => {
      // Backend's real response shape (backend/src/controllers/groupController.ts's
      // getGroups): { success: true, data: <groups>, count: <n> }
      const mockGroups = [
        { id: 1, name: 'Trip to Spain' },
        { id: 2, name: 'Flatmates' },
      ];
      (http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, data: mockGroups, count: mockGroups.length },
      });

      const result = await getGroups();

      // Regression check: getGroups() previously returned response.data
      // (the whole envelope, { success, data, count }) instead of
      // response.data.data (the actual array) -- the exact same bug PR #60
      // fixed in updateGroup(). Asserting the array shape directly, not
      // just "is defined", so this fails clearly if the bug returns.
      expect(result).toEqual(mockGroups);
      expect(Array.isArray(result)).toBe(true);
      expect(http.get).toHaveBeenCalledWith('/groups');
    });

    it('should propagate rejection when http.get fails', async () => {
      const error = new Error('Network error');
      (http.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getGroups()).rejects.toThrow('Network error');
    });
  });
});
