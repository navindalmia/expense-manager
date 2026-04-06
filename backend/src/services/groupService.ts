/**
 * Group Service
 * 
 * Business logic for managing expense groups.
 * Handles group creation, retrieval, member management, and validation.
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';

/**
 * Create a new expense group
 * @param data Group creation data
 * @returns Created group with creator info
 */
export async function createGroup(data: {
  name: string;
  description?: string;
  createdById: number;
  currency?: string;
}) {
  // Validate input
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Group name is required');
  }

  if (data.name.length > 100) {
    throw new Error('Group name must be less than 100 characters');
  }

  try {
    const group = await prisma.group.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        createdById: data.createdById,
        currency: (data.currency || 'GBP') as any,
        members: {
          connect: { id: data.createdById }, // Add creator as member
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        members: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return group;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new Error('Failed to create group');
    }
    throw error;
  }
}

/**
 * Get all active groups for a user
 * @param userId User ID
 * @returns Array of groups
 */
export async function getUserGroups(userId: number) {
  try {
    const groups = await prisma.group.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { createdById: userId },
              { members: { some: { id: userId } } },
            ],
          },
        ],
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        members: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { expenses: true, members: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return groups;
  } catch (error) {
    throw new Error('Failed to fetch groups');
  }
}

/**
 * Get a single group by ID with validation
 * @param groupId Group ID
 * @param userId User ID (for permission check)
 * @returns Group details
 */
export async function getGroupById(groupId: number, userId: number) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        members: {
          select: { id: true, name: true, email: true },
        },
        expenses: {
          select: {
            id: true,
            title: true,
            amount: true,
            currency: true,
          },
          orderBy: { expenseDate: 'desc' },
        },
      },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    if (!group.isActive) {
      throw new Error('Group has been deleted');
    }

    // Check if user is a member or creator
    const isMember = group.members.some((m) => m.id === userId);
    const isCreator = group.createdById === userId;

    if (!isMember && !isCreator) {
      throw new Error('Unauthorized: You are not a member of this group');
    }

    return group;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new Error('Group not found');
    }
    throw error;
  }
}

/**
 * Add member to group by email
 * @param groupId Group ID  
 * @param email Email of user to add
 * @param requestorId User making the request
 * @returns Updated group with members
 */
export async function addMemberByEmail(
  groupId: number,
  email: string,
  requestorId: number
) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!group) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND', { groupId });
    }

    // Only creator can add members
    if (group.createdById !== requestorId) {
      throw new AppError(
        'Unauthorized: Only group creator can add members',
        403,
        'GROUP_UNAUTHORIZED',
        { groupId, requestorId }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new AppError(
        'Unable to add member. Please verify the email address.',
        400,
        'ADD_MEMBER_FAILED'
      );
    }

    // Check if already a member
    const isMember = group.members?.some((m) => m.id === user.id);
    if (isMember) {
      throw new AppError(
        'User is already a member of this group',
        400,
        'ALREADY_MEMBER',
        { userId: user.id, groupId }
      );
    }

    // Add user to group
    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        members: {
          connect: { id: user.id },
        },
      },
      include: {
        members: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return { ...updated, addedMember: user };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to add member to group', 500, 'ADD_MEMBER_ERROR');
  }
}

/**
 * Add member to group (by ID - for backward compatibility)
 * @param groupId Group ID
 * @param memberId User ID to add
 * @param requestorId User making the request
 * @returns Updated group
 */
export async function addMemberToGroup(
  groupId: number,
  memberId: number,
  requestorId: number
) {
  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });

    if (!group) {
      throw new Error('Group not found');
    }

    // Only creator can add members
    if (group.createdById !== requestorId) {
      throw new Error('Unauthorized: Only group creator can add members');
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        members: {
          connect: { id: memberId },
        },
      },
      include: {
        members: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return updated;
  } catch (error) {
    throw error;
  }
}

/**
 * Update/edit a group
 * @param groupId Group ID
 * @param requestorId User making the request
 * @param data Update data (name, description, currency)
 * @returns Updated group
 */
export async function updateGroup(
  groupId: number,
  requestorId: number,
  data: Partial<{ name: string; description: string; currency: string }>
) {
  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });

    if (!group) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND', { groupId });
    }

    // Only creator can edit group
    if (group.createdById !== requestorId) {
      throw new AppError(
        'Unauthorized: Only group creator can edit group',
        403,
        'GROUP_UNAUTHORIZED',
        { groupId, requestorId }
      );
    }

    // Validate update data
    if (data.name !== undefined && data.name.trim().length === 0) {
      throw new AppError('Group name cannot be empty', 400, 'INVALID_NAME');
    }

    if (data.name && data.name.length > 100) {
      throw new AppError('Group name must be less than 100 characters', 400, 'NAME_TOO_LONG');
    }

    if (data.description && data.description.length > 500) {
      throw new AppError('Description must be less than 500 characters', 400, 'DESCRIPTION_TOO_LONG');
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        currency: data.currency as any, // Enum type
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        members: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return updated;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to update group', 500, 'UPDATE_GROUP_ERROR');
  }
}

/**
 * Delete/deactivate a group (soft delete)
 * @param groupId Group ID
 * @param requestorId User making the request
 * @returns Updated group
 */
export async function deactivateGroup(
  groupId: number,
  requestorId: number
) {
  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });

    if (!group) {
      throw new Error('Group not found');
    }

    // Only creator can delete
    if (group.createdById !== requestorId) {
      throw new Error('Unauthorized: Only group creator can delete group');
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: { isActive: false },
    });

    return updated;
  } catch (error) {
    throw error;
  }
}

/**
 * Get group statistics for dashboard
 * @param groupId Group ID
 * @param userId User ID (for permission check)
 * @returns Group stats (total expenses, by member, etc.)
 */
export async function getGroupStats(groupId: number, userId: number) {
  try {
    // Verify user is member or creator
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { select: { id: true } } },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const isMember = group.members.some((m: any) => m.id === userId);
    const isCreator = group.createdById === userId;

    if (!isMember && !isCreator) {
      throw new Error('Unauthorized: You are not a member of this group');
    }

    const expenses = await prisma.expense.findMany({
      where: { groupId, isSettled: false },
      include: {
        paidBy: { select: { id: true, name: true } },
      },
    });

    const totalAmount = expenses.reduce(
      (sum: number, exp: any) => sum + exp.amount,
      0
    );

    // Group by payer
    const byPayer: Record<number, { name: string; amount: number }> = {};
    expenses.forEach((exp: any) => {
      if (!byPayer[exp.paidById]) {
        byPayer[exp.paidById] = { name: exp.paidBy.name, amount: 0 };
      }
      byPayer[exp.paidById]!.amount += exp.amount;
    });

    return {
      totalExpenses: expenses.length,
      totalAmount,
      byPayer,
      currency: expenses.length > 0 ? (expenses[0] as any).currency : 'GBP',
    };
  } catch (error) {
    throw new Error('Failed to fetch group statistics');
  }
}

/**
 * Get all expenses for a specific group
 * @param groupId Group ID
 * @param userId User ID (for permission check)
 * @returns Array of expenses for the group
 */
export async function getGroupExpenses(groupId: number, userId: number) {
  try {
    // Verify group exists and user is member or creator
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { select: { id: true } } },
    });

    if (!group) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND', { groupId });
    }

    const isMember = group.members.some((m: any) => m.id === userId);
    const isCreator = group.createdById === userId;

    if (!isMember && !isCreator) {
      throw new AppError(
        'Unauthorized: You are not a member of this group',
        403,
        'GROUP_UNAUTHORIZED',
        { groupId, userId }
      );
    }

    // Fetch expenses ONLY for this group (not orphan expenses)
    const expenses = await prisma.expense.findMany({
      where: {
        groupId, // CRITICAL: Filter by groupId
        isSettled: false,
      },
      include: {
        paidBy: {
          select: { id: true, name: true, email: true },
        },
        category: true,
        splitWith: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { expenseDate: 'desc' },
    });

    return expenses;
  } catch (error) {
    if (error instanceof AppError) {
      throw error; // Re-throw AppError as-is
    }
    throw new AppError('Failed to fetch group expenses', 500, 'FETCH_EXPENSES_ERROR');
  }
}
