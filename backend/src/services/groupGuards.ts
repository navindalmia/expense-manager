import { Prisma } from '@prisma/client';
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

/** Minimal group shape needed for membership checks. */
export interface GroupWithMembers {
  createdById: number;
  members: { id: number }[];
}

/**
 * Prisma predicate for "groups this user can access": active groups the user
 * created or belongs to. Same predicate as groupService.getUserGroups.
 */
export function accessibleGroupWhere(userId: number): Prisma.GroupWhereInput {
  return {
    AND: [{ isActive: true }, { OR: [{ createdById: userId }, { members: { some: { id: userId } } }] }],
  };
}

export function isGroupMember(group: GroupWithMembers, userId: number): boolean {
  return group.createdById === userId || group.members.some((m) => m.id === userId);
}

/**
 * Fail closed unless the user created or belongs to the group (403): used
 * where the caller addressed the group explicitly.
 */
export function assertGroupMember(group: GroupWithMembers, userId: number, groupId: number): void {
  if (!isGroupMember(group, userId)) {
    throw new AppError('GROUP.NOT_MEMBER', 403, 'GROUP_UNAUTHORIZED', { groupId, userId });
  }
}

/**
 * Fail closed unless the user can access the expense's group. Responds 404
 * (identical to a missing expense) so expense ids cannot be enumerated.
 */
export function assertExpenseAccess(group: GroupWithMembers, userId: number, expenseId: number): void {
  if (!isGroupMember(group, userId)) {
    throw expenseNotFound(expenseId);
  }
}

/**
 * The single 404 used for a missing expense AND for one the caller may not
 * access, so the two cases are byte-identical and ids cannot be enumerated.
 */
export function expenseNotFound(expenseId: number): AppError {
  return new AppError('EXPENSE.NOT_FOUND', 404, 'EXPENSE_NOT_FOUND', { expenseId });
}
