import { AppError } from '../errors/AppError';

/**
 * Soft-deleted groups (isActive = false) are treated as non-existent for every
 * caller. Data is retained for support recovery, never served to users.
 * Throws the same 404 whether the group is missing or deleted, so a deleted
 * group cannot be told apart from one that never existed.
 */
export function assertGroupActive<T extends { isActive: boolean }>(
  group: T | null,
  groupId: number
): asserts group is T {
  if (!group || !group.isActive) {
    throw new AppError('GROUP.NOT_FOUND', 404, 'GROUP_NOT_FOUND', { groupId });
  }
}
