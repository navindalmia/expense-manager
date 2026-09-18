/**
 * Group Service Tests
 *
 * Validates the GroupService API wrapper functions against a mocked
 * `http` client (the shared axios instance in src/api/http), exercising
 * the real exported service functions rather than the http client directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateGroup } from '../groupService';
import { http } from '../../api/http';

vi.mock('../../api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('GroupService API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateGroup', () => {
    // Regression test for issue #44: the group list on HomeScreen silently
    // failed to update after editing a group (name/description/currency)
    // until a manual pull-to-refresh, because updateGroup() returned the
    // raw { success, data, message } envelope instead of unwrapping it,
    // so callers' `updatedGroup.id` was always undefined.
    it('should unwrap the { success, data, message } envelope and return the group itself', async () => {
      const mockGroup = {
        id: 5,
        name: 'Trip to Spain',
        currency: { id: 3, code: 'EUR', label: 'Euro' },
      };

      (http.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          success: true,
          data: mockGroup,
          message: 'Group updated successfully',
        },
      });

      const result = await updateGroup(5, { currency: 'EUR' });

      expect(result).toEqual(mockGroup);
      expect(result.id).toBe(5);
    });

    it('should send the update payload to the correct endpoint', async () => {
      (http.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, data: { id: 7 }, message: 'ok' },
      });

      await updateGroup(7, { name: 'New Name' });

      expect(http.patch).toHaveBeenCalledWith('/groups/7', { name: 'New Name' });
    });
  });
});
