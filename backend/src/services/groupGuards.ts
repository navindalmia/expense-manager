import { Prisma } from '@prisma/client';

/**
 * Prisma predicate for "groups this user can access": active groups the user
 * created or belongs to. Same predicate as groupService.getUserGroups.
 */
export function accessibleGroupWhere(userId: number): Prisma.GroupWhereInput {
  return {
    AND: [{ isActive: true }, { OR: [{ createdById: userId }, { members: { some: { id: userId } } }] }],
  };
}
