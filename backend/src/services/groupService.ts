/**
 * Group Service
 * 
 * Business logic for managing expense groups.
 * Handles group creation, retrieval, member management, and validation.
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';

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
 * Add member to group
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
