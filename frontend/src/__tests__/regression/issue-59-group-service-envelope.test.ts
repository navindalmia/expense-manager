/**
 * Group Service Tests
 *
 * Regression tests for issue #59: getGroups() and deleteGroup() must unwrap
 * the backend `{ success, data, ... }` envelope like updateGroup() does.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGroups, deleteGroup, updateGroup } from '../../services/groupService';
import type { Group } from '../../services/groupService';
import { http } from '../../api/http';

vi.mock('../../api/http', () => ({
  http: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const makeGroup = (id: number, name: string): Group => ({
  id,
  name,
  currency: { id: 1, code: 'USD', label: 'US Dollar' },
  totalAmount: 0,
  userPersonalTotal: 0,
  createdBy: { id: 1, name: 'A', email: 'a@x.com' },
  members: [],
  _count: { expenses: 0, members: 0 },
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('groupService envelope unwrapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the groups array when getGroups receives a { success, data, count } envelope', async () => {
    const groups = [makeGroup(1, 'Trip'), makeGroup(2, 'Home')];
    vi.mocked(http.get).mockResolvedValue({ data: { success: true, data: groups, count: 2 } });

    const result = await getGroups();

    expect(http.get).toHaveBeenCalledWith('/groups');
    expect(result).toEqual(groups);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return the deleted group when deleteGroup receives a { success, data, message } envelope', async () => {
    const group = makeGroup(5, 'Old');
    vi.mocked(http.delete).mockResolvedValue({ data: { success: true, data: group, message: 'deleted' } });

    const result = await deleteGroup(5);

    expect(http.delete).toHaveBeenCalledWith('/groups/5');
    expect(result).toEqual(group);
    expect(result.id).toBe(5);
  });

  it('should return the updated group when updateGroup receives an envelope', async () => {
    const group = makeGroup(3, 'Renamed');
    vi.mocked(http.patch).mockResolvedValue({ data: { success: true, data: group } });

    expect(await updateGroup(3, { name: 'Renamed' })).toEqual(group);
  });

  it('should return an empty array when getGroups receives an empty envelope', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { success: true, data: [], count: 0 } });

    expect(await getGroups()).toEqual([]);
  });

  it('should reject when getGroups fails at the HTTP layer', async () => {
    vi.mocked(http.get).mockRejectedValue(new Error('network down'));

    await expect(getGroups()).rejects.toThrow('network down');
  });

  it('should reject when deleteGroup fails at the HTTP layer', async () => {
    vi.mocked(http.delete).mockRejectedValue(new Error('forbidden'));

    await expect(deleteGroup(5)).rejects.toThrow('forbidden');
  });
});
