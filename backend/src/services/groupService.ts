/**
 * Group Service
 * 
 * Business logic for managing expense groups.
 * Handles group creation, retrieval, member management, and validation.
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * Expense data from database with required fields for split calculations
 */
interface ExpenseWithSplit {
  amount: number;
  paidById: number;
  splitType: 'EQUAL' | 'AMOUNT' | 'PERCENTAGE';
  splitWith: { id: number }[];
  splitAmount?: number[] | null;
  splitPercentage?: number[] | null;
}

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
    // Look up currency by code to get ID
    const currencyCode = data.currency || 'GBP';
    const currencyRecord = await prisma.currency.findUnique({
      where: { code: currencyCode },
    });

    if (!currencyRecord) {
      throw new Error(`Currency ${currencyCode} not found`);
    }

    const group = await prisma.group.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        createdById: data.createdById,
        currencyId: currencyRecord.id,
        members: {
          connect: { id: data.createdById }, // Add creator as member
        },
      },
      include: {
        currency: {
          select: { id: true, code: true, label: true },
        },
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
        currency: {
          select: { id: true, code: true, label: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        members: {
          select: { id: true, name: true, email: true },
        },
        expenses: {
          select: {
            amount: true,
            paidById: true,
            splitType: true,
            splitAmount: true,
            splitPercentage: true,
            splitWith: {
              select: { id: true },
            },
          },
        },
        _count: {
          select: { expenses: true, members: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Calculate total amount and user's personal split for each group
    return groups.map((group) => {
      const totalAmount = group.expenses.reduce((sum: number, exp: ExpenseWithSplit) => sum + exp.amount, 0);
      
      // Calculate user's personal split total
      const userPersonalTotal = group.expenses.reduce((sum: number, exp: ExpenseWithSplit) => {
        let userShare = 0;
        
        // Check if user is the payer
        if (exp.paidById === userId) {
          // User is payer - calculate their share based on split type
          if (exp.splitType === 'EQUAL' && exp.splitWith && exp.splitWith.length > 0) {
            userShare = exp.amount / (exp.splitWith.length + 1);
          } else if (exp.splitType === 'PERCENTAGE' && exp.splitPercentage && exp.splitPercentage.length > 0 && typeof exp.splitPercentage[0] === 'number') {
            // Payer's % is at index 0
            userShare = (exp.amount * exp.splitPercentage[0]) / 100;
          } else if (
            exp.splitType === 'AMOUNT' &&
            exp.splitAmount &&
            exp.splitAmount.length > 0
          ) {
            // Amount split: total - sum of others' amounts
            const othersTotal = exp.splitAmount.reduce((a: number, b: number) => a + b, 0);
            userShare = Math.max(0, exp.amount - othersTotal);
          } else if (!exp.splitWith || exp.splitWith.length === 0) {
            // No split - user pays full amount
            userShare = exp.amount;
          }
        } else {
          // User is in splitWith - find their share
          const userIndex = exp.splitWith?.findIndex((u) => u.id === userId) ?? -1;
          if (userIndex !== -1) {
            if (exp.splitType === 'EQUAL') {
              userShare = exp.amount / (exp.splitWith.length + 1);
            } else if (
              exp.splitType === 'PERCENTAGE' &&
              exp.splitPercentage &&
              exp.splitPercentage.length > userIndex + 1 &&
              typeof exp.splitPercentage[userIndex + 1] === 'number'
            ) {
              // Members' percentages start at index 1
              const percentage = exp.splitPercentage[userIndex + 1];
              if (typeof percentage === 'number' && !isNaN(percentage)) {
                userShare = (exp.amount * percentage) / 100;
              }
            } else if (
              exp.splitType === 'AMOUNT' &&
              exp.splitAmount &&
              exp.splitAmount.length > userIndex &&
              typeof exp.splitAmount[userIndex] === 'number'
            ) {
              userShare = Math.max(0, exp.splitAmount[userIndex]);
            }
          }
        }
        
        return sum + userShare;
      }, 0);
      
      return {
        ...group,
        totalAmount,
        userPersonalTotal,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error('Database error fetching groups', error, { userId });
      throw new AppError('Failed to fetch groups', 500, 'DB_ERROR');
    }
    if (error instanceof AppError) throw error;
    logger.error('Unexpected error fetching groups', error, { userId });
    throw new AppError('Failed to fetch groups', 500, 'UNKNOWN_ERROR');
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
        currency: {
          select: { id: true, code: true, label: true },
        },
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
      logger.error('Database error fetching group', error, { groupId, userId });
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    }
    if (error instanceof AppError) throw error;
    logger.error('Unexpected error fetching group', error, { groupId, userId });
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

    // Find user by email, OR create placeholder if doesn't exist
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true },
    });

    // If user doesn't exist, create placeholder (email-based, no password yet)
    if (!user) {
      const emailPrefix = email.toLowerCase().split('@')[0] || 'member';
      user = await prisma.user.create({
        data: {
          name: emailPrefix, // Use email prefix as default name
          email: email.toLowerCase(),
          // password stays null until they signup - auth middleware MUST validate this
        },
        select: { id: true, email: true, name: true },
      });
      logger.info('Created placeholder user from group invite', { email: user.email, userId: user.id });
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
  memberName: string,
  memberEmail?: string,
  requestorId?: number
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
    if (requestorId && group.createdById !== requestorId) {
      throw new AppError(
        'Unauthorized: Only group creator can add members',
        403,
        'GROUP_UNAUTHORIZED',
        { groupId, requestorId }
      );
    }

    // Smart user lookup/creation logic:
    // 1. If email provided: find existing user with that email OR create placeholder
    // 2. If no email: create user with just name (no email, no password)
    let user;

    if (memberEmail) {
      // Try to find existing user with this email
      user = await prisma.user.findUnique({
        where: { email: memberEmail },
        select: { id: true, email: true, name: true },
      });

      // If doesn't exist, create placeholder user with name + email (password is null)
      if (!user) {
        user = await prisma.user.create({
          data: {
            name: memberName,
            email: memberEmail,
            // password stays null until they signup
          },
          select: { id: true, email: true, name: true },
        });
      }
    } else {
      // No email provided: create user with just name
      user = await prisma.user.create({
        data: {
          name: memberName,
          // email is null, password is null
        },
        select: { id: true, email: true, name: true },
      });
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
    try {
      const updated = await prisma.group.update({
        where: { id: groupId },
        data: {
          members: {
            connect: { id: user.id },
          },
        },
        include: {
          currency: {
            select: { id: true, code: true, label: true },
          },
          members: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return { ...updated, addedMember: user };
    } catch (error: any) {
      // Handle unique constraint if this somehow wasn't caught by earlier check
      // (defensive programming for race conditions)
      if (error.code === 'P2025') {
        throw new AppError(
          'User is already a member of this group',
          400,
          'ALREADY_MEMBER',
          { userId: user.id, groupId }
        );
      }
      throw error;
    }
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

    // Build update object only with provided fields
    const updateData: any = {};

    if (data.name !== undefined && data.name !== null) {
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined && data.description !== null) {
      updateData.description = data.description.trim() || null; // Allow clearing description
    }

    if (data.currency !== undefined && data.currency !== null) {
      // Look up currency by code to get ID
      const currencyRecord = await prisma.currency.findUnique({
        where: { code: data.currency },
      });
      if (!currencyRecord) {
        throw new AppError(`Currency ${data.currency} not found`, 400, 'CURRENCY_NOT_FOUND');
      }
      updateData.currencyId = currencyRecord.id;
    }

    // If no fields to update, fetch and return group with all relationships
    if (Object.keys(updateData).length === 0) {
      return await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          currency: {
            select: { id: true, code: true, label: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          members: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              expenses: true,
              members: true,
            },
          },
        },
      }) as any;
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: updateData,
      include: {
        currency: {
          select: { id: true, code: true, label: true },
        },
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
