/**
 * Expense Service
 * 
 * Business logic for managing expenses within groups.
 * Handles creation, retrieval, deletion with validation.
 */

import prisma from "../lib/prisma";
import { SplitType, Prisma } from "@prisma/client";
import { cleanData } from "../utils/cleanData";
import { AppError } from "../errors/AppError";

/**
 * Get all expenses for a specific group with permission check
 * 
 * @param groupId - The group ID to fetch expenses for
 * @param userId - The current user ID (for authorization)
 * @throws AppError if user is not a member of the group
 * @returns Array of expenses with full relationships (currency, paidBy, category, splitWith)
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

    // Check authorization: user must be member or creator
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

    // Fetch expenses for this group only
    const expenses = await prisma.expense.findMany({
      where: {
        groupId,
        isSettled: false,
      },
      include: {
        currency: {
          select: { id: true, code: true, label: true },
        },
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
      throw error; // Re-throw AppError with proper context
    }
    throw new AppError('Failed to fetch expenses', 500, 'FETCH_ERROR', { error });
  }
}

/**
 * Get all expenses (DEPRECATED - kept for backward compatibility)
 */
export async function getAllExpenses() {
  return prisma.expense.findMany({
    include: {
      paidBy: true,
      category: true,
      splitWith: true,
    },
  });
}

export async function createExpense(data: {
  title: string;
  amount: number;
  currency?: string;
  groupId: number;
  paidById: number;
  categoryId: number;
  splitWithIds?: number[];
  splitType?: SplitType;
  splitAmount?: number[];
  splitPercentage?: number[];
  notes?: string;
  expenseDate: string;
}) {
  const {
    title,
    amount,
    currency = 'GBP',
    groupId,
    paidById,
    categoryId,
    splitWithIds = [],
    splitType = SplitType.EQUAL,
    splitAmount = [],
    splitPercentage = [],
    notes,
    expenseDate,
  } = data;

  // Validation
  if (!title || title.trim().length === 0) {
    throw new Error('Expense title is required');
  }

  if (amount <= 0) {
    throw new Error('Expense amount must be greater than 0');
  }

  let finalSplitAmounts: number[] = [];

  if (splitWithIds.length > 0) {
    switch (splitType) {
      case SplitType.EQUAL:
        // Payer is now optional in split - only divide by actual split member count
        const perPerson = parseFloat((amount / splitWithIds.length).toFixed(2));
        finalSplitAmounts = new Array(splitWithIds.length).fill(perPerson);
        break;

      case SplitType.AMOUNT:
        const sumAmount = splitAmount.reduce((a, b) => a + b, 0);
        if (Math.abs(sumAmount - amount) > 0.01)
          throw new AppError("EXPENSE.SPLIT_SUM_MISMATCH", 400, "EXPENSE_SPLIT_INVALID");
        finalSplitAmounts = splitAmount;
        break;

      case SplitType.PERCENTAGE:
        const sumPercentage = splitPercentage.reduce((a, b) => a + b, 0);
        if (Math.abs(sumPercentage - 100) > 0.01)
          throw new AppError("EXPENSE.SPLIT_PERCENTAGE_INVALID", 400, "EXPENSE_PERCENT_INVALID");

        finalSplitAmounts = splitPercentage.map((p) =>
          parseFloat(((p / 100) * amount).toFixed(2))
        );
        break;
    }
  }

  try {
    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { select: { id: true } } },
    });

    if (!group) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND', { groupId });
    }

    // Verify paidById user is a member of the group
    const isPayerMember = group.members.some((m) => m.id === paidById);
    if (!isPayerMember && group.createdById !== paidById) {
      throw new AppError(
        'Payer is not a member of this group',
        403,
        'USER_NOT_GROUP_MEMBER',
        { groupId, paidById }
      );
    }

    // Look up category to verify it exists
    const categoryRecord = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!categoryRecord) {
      throw new AppError(
        'Category not found',
        404,
        'CATEGORY_NOT_FOUND',
        { categoryId }
      );
    }

    // Look up currency by code to get ID
    const currencyRecord = await prisma.currency.findUnique({
      where: { code: currency },
    });

    if (!currencyRecord) {
      throw new AppError(
        `Currency ${currency} not found`,
        404,
        'CURRENCY_NOT_FOUND',
        { currency }
      );
    }

    // Build the expense data object
    const expenseData: Prisma.ExpenseCreateInput = {
      title,
      amount,
      currency: { connect: { id: currencyRecord.id } },
      group: { connect: { id: groupId } },
      paidBy: { connect: { id: paidById } },
      category: { connect: { id: categoryId } },
      splitType,
      notes: notes || null,
      expenseDate: new Date(expenseDate),
    };

    // Add splitWith relationship only if there are split members
    if (splitWithIds.length > 0) {
      expenseData.splitWith = { connect: splitWithIds.map((id) => ({ id })) };
      expenseData.splitAmount = finalSplitAmounts;
      if (splitType === SplitType.PERCENTAGE) {
        expenseData.splitPercentage = splitPercentage;
      }
    }

    return prisma.expense.create({
      data: expenseData,
      include: {
        currency: { select: { id: true, code: true, label: true } },
        paidBy: { select: { id: true, name: true, email: true } },
        category: true,
        splitWith: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new AppError(
          'Related record not found',
          404,
          'RELATED_RECORD_NOT_FOUND',
          { error: error.message }
        );
      }
      throw new AppError(
        'Database error occurred',
        500,
        'DATABASE_ERROR',
        { error: error.message }
      );
    }
    throw new AppError(
      'Failed to create expense',
      500,
      'CREATE_EXPENSE_ERROR',
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

export async function deleteExpense(id: number) {
  return prisma.expense.delete({ where: { id } });
}

/**
 * Get a single expense by ID with permission check
 * 
 * @param expenseId - The expense ID to fetch
 * @param userId - The current user ID (for authorization)
 * @throws AppError if expense not found or user is not a member of the group
 * @returns Expense with full relationships
 */
export async function getExpenseById(expenseId: number, userId: number) {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        group: {
          select: { id: true, members: { select: { id: true } }, createdById: true },
        },
        currency: { select: { id: true, code: true, label: true } },
        paidBy: { select: { id: true, name: true, email: true } },
        category: true,
        splitWith: { select: { id: true, name: true, email: true } },
      },
    });

    if (!expense) {
      throw new AppError('Expense not found', 404, 'EXPENSE_NOT_FOUND', { expenseId });
    }

    // Check authorization: user must be member or creator of the group
    const isMember = expense.group.members.some((m) => m.id === userId);
    const isCreator = expense.group.createdById === userId;

    if (!isMember && !isCreator) {
      throw new AppError(
        'Unauthorized: You are not a member of this group',
        403,
        'GROUP_UNAUTHORIZED',
        { expenseId, userId }
      );
    }

    return expense;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to fetch expense', 500, 'FETCH_ERROR', { error });
  }
}

/**
 * Update an existing expense with partial data
 * 
 * @param expenseId - The expense ID to update
 * @param userId - The current user ID (for authorization)
 * @param data - Partial expense data to update
 * @throws AppError if expense not found, user not authorized, or validation fails
 * @returns Updated expense with full relationships
 */
export async function updateExpense(
  expenseId: number,
  userId: number,
  data: {
    title?: string;
    amount?: number;
    categoryId?: number;
    paidById?: number;
    splitWithIds?: number[];
    splitType?: SplitType;
    splitAmount?: number[];
    splitPercentage?: number[];
    notes?: string;
    expenseDate?: string;
  }
) {
  try {
    // Fetch existing expense with full relationships for authorization and split handling
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        group: {
          select: { id: true, members: { select: { id: true } }, createdById: true },
        },
        splitWith: { select: { id: true } },
      },
    });

    if (!expense) {
      throw new AppError('Expense not found', 404, 'EXPENSE_NOT_FOUND', { expenseId });
    }

    // Check authorization: user must be member or creator of the group
    const isMember = expense.group.members.some((m) => m.id === userId);
    const isCreator = expense.group.createdById === userId;

    if (!isMember && !isCreator) {
      throw new AppError(
        'Unauthorized: You are not a member of this group',
        403,
        'GROUP_UNAUTHORIZED',
        { expenseId, userId }
      );
    }

    const {
      title,
      amount,
      categoryId,
      paidById,
      splitWithIds,
      splitType = expense.splitType,
      splitAmount,
      splitPercentage,
      notes,
      expenseDate,
    } = data;

    // Validation
    if (title !== undefined && (!title || title.trim().length === 0)) {
      throw new AppError('Expense title is required', 400, 'INVALID_TITLE');
    }

    if (amount !== undefined && amount <= 0) {
      throw new AppError('Expense amount must be greater than 0', 400, 'INVALID_AMOUNT');
    }

    let finalSplitAmounts: number[] = [];
    const finalAmount = amount ?? expense.amount;

    // Validate category if provided
    if (categoryId !== undefined) {
      const categoryRecord = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!categoryRecord) {
        throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND', { categoryId });
      }
    }

    // Validate paidBy if provided
    if (paidById !== undefined) {
      const payerMember = expense.group.members.some((m) => m.id === paidById);
      if (!payerMember && expense.group.createdById !== paidById) {
        throw new AppError(
          'Payer is not a member of this group',
          403,
          'USER_NOT_GROUP_MEMBER',
          { groupId: expense.group.id, paidById }
        );
      }
    }

    // Handle split recalculation if splitWithIds or amount changes
    if (splitWithIds !== undefined || amount !== undefined) {
      const finalSplitIds = splitWithIds ?? expense.splitWith.map((u: any) => u.id);

      if (finalSplitIds.length > 0) {
        const effectiveSplitType = splitType ?? expense.splitType;

        switch (effectiveSplitType) {
          case SplitType.EQUAL:
            // Payer is now optional in split - only divide by actual split member count
            const perPerson = parseFloat((finalAmount / finalSplitIds.length).toFixed(2));
            finalSplitAmounts = new Array(finalSplitIds.length).fill(perPerson);
            break;

          case SplitType.AMOUNT:
            const newSplitAmount = splitAmount ?? expense.splitAmount;
            const sumAmount = newSplitAmount.reduce((a, b) => a + b, 0);
            if (Math.abs(sumAmount - finalAmount) > 0.01) {
              throw new AppError('Split amounts do not match total amount', 400, 'EXPENSE_SPLIT_INVALID');
            }
            finalSplitAmounts = newSplitAmount;
            break;

          case SplitType.PERCENTAGE:
            const newSplitPercentage = splitPercentage ?? expense.splitPercentage;
            const sumPercentage = newSplitPercentage.reduce((a, b) => a + b, 0);
            if (Math.abs(sumPercentage - 100) > 0.01) {
              throw new AppError('Split percentages must sum to 100', 400, 'EXPENSE_PERCENT_INVALID');
            }
            finalSplitAmounts = newSplitPercentage.map((p) =>
              parseFloat(((p / 100) * finalAmount).toFixed(2))
            );
            break;
        }
      }
    }

    // Build update data
    const updateData: Prisma.ExpenseUpdateInput = {};

    if (title !== undefined) updateData.title = title;
    if (amount !== undefined) updateData.amount = amount;
    if (categoryId !== undefined) updateData.category = { connect: { id: categoryId } };
    if (paidById !== undefined) updateData.paidBy = { connect: { id: paidById } };
    if (notes !== undefined) updateData.notes = notes || null;
    if (expenseDate !== undefined) updateData.expenseDate = new Date(expenseDate);
    if (splitType !== undefined) updateData.splitType = splitType;

    // Handle split changes
    if (splitWithIds !== undefined) {
      if (splitWithIds.length > 0) {
        updateData.splitWith = { set: splitWithIds.map((id) => ({ id })) };
        updateData.splitAmount = finalSplitAmounts;
        if (splitType === SplitType.PERCENTAGE || (splitType === undefined && expense.splitType === SplitType.PERCENTAGE)) {
          updateData.splitPercentage = splitPercentage ?? expense.splitPercentage;
        }
      } else {
        updateData.splitWith = { set: [] };
        updateData.splitAmount = [];
        updateData.splitPercentage = [];
      }
    }

    return prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
      include: {
        currency: { select: { id: true, code: true, label: true } },
        paidBy: { select: { id: true, name: true, email: true } },
        category: true,
        splitWith: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new AppError(
          'Related record not found',
          404,
          'RELATED_RECORD_NOT_FOUND',
          { error: error.message }
        );
      }
      throw new AppError(
        'Database error occurred',
        500,
        'DATABASE_ERROR',
        { error: error.message }
      );
    }
    throw new AppError(
      'Failed to update expense',
      500,
      'UPDATE_EXPENSE_ERROR',
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}
