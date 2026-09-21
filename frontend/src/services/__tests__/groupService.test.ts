/**
 * Group Service Tests
 *
 * Validates the GroupService API wrapper functions against a mocked
 * `http` client (the shared axios instance in src/api/http), exercising
 * the real exported service functions rather than the http client directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deleteGroup } from '../groupService';
import { http } from '../../api/http';

vi.mock('../../api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('GroupService API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteGroup', () => {
    // Regression test for the deleteGroup() envelope-unwrap bug found
    // while wiring up issue #47's delete-group UI (previously dead code,
    // never called, so this bug -- the same class as issue #44's
    // updateGroup() bug -- had never surfaced).
    it('should unwrap the { success, data, message } envelope and return the group itself', async () => {
      const mockGroup = { id: 5, name: 'Trip to Spain', isActive: false };

      (http.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          success: true,
          data: mockGroup,
          message: 'Group deleted successfully',
        },
      });

      const result = await deleteGroup(5);

      expect(result).toEqual(mockGroup);
      expect(result.id).toBe(5);
    });

    it('should call the correct endpoint', async () => {
      (http.delete as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, data: { id: 7 }, message: 'ok' },
      });

      await deleteGroup(7);

      expect(http.delete).toHaveBeenCalledWith('/groups/7');
    });

    it('should propagate rejection when http.delete fails', async () => {
      const error = new Error('Unauthorized');
      (http.delete as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(deleteGroup(1)).rejects.toThrow('Unauthorized');
    });
  });
});
