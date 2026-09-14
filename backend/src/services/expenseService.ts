/**
 * Expense Service
 * 
 * Business logic for managing expenses within groups.
 * Handles creation, retrieval, deletion with validation.
 */

import prisma from "../lib/prisma";
import { SplitType, Prisma } from "@prisma/client";
import { cleanData } from "../utils/cleanData";
import { distributeAmountEvenly, distributeAmountByWeights, hasNonPositiveValue } from "../utils/splitCalculation";
import { AppError } from "../errors/AppError";
import { assertLabelVisible } from "./labelService";
import { rankMatches } from "../lib/fuzzyMatch";
import { suggestCategoryCode } from "../lib/categoryKeywordDictionary";

const SUGGESTION_LIMIT = 5;

/**
 * Prefill payload returned alongside each suggested match -- deliberately
 * omits expenseDate (AE2): the frontend always defaults the date to today
 * rather than reusing a past expense's date.
 */
export interface SimilarExpenseMatch {
  expenseId: number;
  title: string;
  amount: number;
  categoryId: number;
  splitWithIds: number[];
}

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
  labelId?: number;
  splitWithIds?: number[];
  splitType?: SplitType;
  splitAmount?: number[];
  splitPercentage?: number[];
  notes?: string;
  expenseDate: string;
  suggestedCategoryId?: number;
}) {
  const {
    title,
    amount,
    currency = 'GBP',
    groupId,
    paidById,
    categoryId,
    labelId,
    splitWithIds = [],
    splitType = SplitType.EQUAL,
    splitAmount = [],
    splitPercentage = [],
    notes,
    expenseDate,
    suggestedCategoryId,
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
        finalSplitAmounts = distributeAmountEvenly(amount, splitWithIds.length);
        break;

      case SplitType.AMOUNT:
        if (hasNonPositiveValue(splitAmount))
          throw new AppError("EXPENSE.SPLIT_AMOUNT_INVALID", 400, "EXPENSE_SPLIT_INVALID");
        const sumAmount = splitAmount.reduce((a, b) => a + b, 0);
        if (Math.abs(sumAmount - amount) > 0.01)
          throw new AppError("EXPENSE.SPLIT_SUM_MISMATCH", 400, "EXPENSE_SPLIT_INVALID");
        finalSplitAmounts = splitAmount;
        break;

      case SplitType.PERCENTAGE:
        if (hasNonPositiveValue(splitPercentage))
          throw new AppError("EXPENSE.SPLIT_PERCENTAGE_INVALID", 400, "EXPENSE_PERCENT_INVALID");
        const sumPercentage = splitPercentage.reduce((a, b) => a + b, 0);
        if (Math.abs(sumPercentage - 100) > 0.01)
          throw new AppError("EXPENSE.SPLIT_PERCENTAGE_INVALID", 400, "EXPENSE_PERCENT_INVALID");

        finalSplitAmounts = distributeAmountByWeights(amount, splitPercentage);
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

    // Verify every split participant is a member of this group -- e.g. U9's
    // title autocomplete can prefill splitWithIds from a match found in a
    // *different* group (findSimilarExpenses is deliberately global), so
    // this can't be trusted from the client alone.
    const groupMemberIds = new Set(group.members.map((m) => m.id));
    const invalidSplitMemberId = splitWithIds.find((id) => !groupMemberIds.has(id) && id !== group.createdById);
    if (invalidSplitMemberId !== undefined) {
      throw new AppError(
        'Split member is not a member of this group',
        403,
        'USER_NOT_GROUP_MEMBER',
        { groupId, invalidSplitMemberId }
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

    if (labelId !== undefined) {
      // paidById doubles as the requesting user's id -- the controller
      // always sets it from the JWT (see expenseController.createExpense)
      await assertLabelVisible(paidById, labelId);
    }

    // Build the expense data object
    const expenseData: Prisma.ExpenseCreateInput = {
      title,
      amount,
      currency: { connect: { id: currencyRecord.id } },
      group: { connect: { id: groupId } },
      paidBy: { connect: { id: paidById } },
      category: { connect: { id: categoryId } },
      ...(labelId !== undefined ? { label: { connect: { id: labelId } } } : {}),
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

    const expense = await prisma.expense.create({
      data: expenseData,
      include: {
        currency: { select: { id: true, code: true, label: true } },
        paidBy: { select: { id: true, name: true, email: true } },
        category: true,
        splitWith: { select: { id: true, name: true, email: true } },
      },
    });

    // Best-effort audit write (KTD10) -- only when R8's suggestion flow
    // actually fired. Diagnostic/historical data, not a source of truth,
    // so a failure here must never fail expense creation itself.
    if (suggestedCategoryId !== undefined) {
      try {
        await prisma.categorySuggestionAudit.create({
          data: {
            expenseId: expense.id,
            suggestedCategoryId,
            acceptedCategoryId: categoryId,
            titleText: title,
          },
        });
      } catch (auditError) {
        console.error('Failed to write category suggestion audit:', auditError);
      }
    }

    return expense;
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

/**
 * Delete an expense with authorization check
 * 
 * @param expenseId - The expense ID to delete
 * @param userId - The current user ID (for authorization)
 * @throws AppError if expense not found or user is not a member of the group
 * @returns void
 */
export async function deleteExpense(expenseId: number, userId: number) {
  try {
    // Fetch expense to verify group membership
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        group: {
          select: { id: true, members: { select: { id: true } }, createdById: true },
        },
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

    // Delete the expense
    return prisma.expense.delete({ where: { id: expenseId } });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'Failed to delete expense',
      500,
      'DELETE_ERROR',
      { expenseId, error }
    );
  }
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
    labelId?: number;
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
      labelId,
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

    // Recalculate the split from the *effective* configuration (existing or
    // newly-provided) on every update, not just when splitWithIds/amount are
    // explicitly passed. Recomputation is idempotent when nothing split-
    // related actually changed, and doing it unconditionally avoids the
    // previous bug where e.g. an amount-only edit recalculated
    // finalSplitAmounts correctly but never got persisted (see below) because
    // the write-back was gated on splitWithIds alone.
    const finalSplitIds = splitWithIds ?? expense.splitWith.map((u: any) => u.id);
    let finalSplitPercentage: number[] | undefined;

    if (finalSplitIds.length > 0) {
      const effectiveSplitType = splitType ?? expense.splitType;

      switch (effectiveSplitType) {
        case SplitType.EQUAL:
          // Payer is now optional in split - only divide by actual split member count
          finalSplitAmounts = distributeAmountEvenly(finalAmount, finalSplitIds.length);
          break;

        case SplitType.AMOUNT: {
          const newSplitAmount = splitAmount ?? expense.splitAmount;
          if (hasNonPositiveValue(newSplitAmount)) {
            throw new AppError('EXPENSE.SPLIT_AMOUNT_INVALID', 400, 'EXPENSE_SPLIT_INVALID');
          }
          const sumAmount = newSplitAmount.reduce((a, b) => a + b, 0);
          if (Math.abs(sumAmount - finalAmount) > 0.01) {
            throw new AppError('Split amounts do not match total amount', 400, 'EXPENSE_SPLIT_INVALID');
          }
          finalSplitAmounts = newSplitAmount;
          break;
        }

        case SplitType.PERCENTAGE: {
          const newSplitPercentage = splitPercentage ?? expense.splitPercentage;
          if (hasNonPositiveValue(newSplitPercentage)) {
            throw new AppError('EXPENSE.SPLIT_PERCENTAGE_INVALID', 400, 'EXPENSE_PERCENT_INVALID');
          }
          const sumPercentage = newSplitPercentage.reduce((a, b) => a + b, 0);
          if (Math.abs(sumPercentage - 100) > 0.01) {
            throw new AppError('Split percentages must sum to 100', 400, 'EXPENSE_PERCENT_INVALID');
          }
          finalSplitAmounts = distributeAmountByWeights(finalAmount, newSplitPercentage);
          finalSplitPercentage = newSplitPercentage;
          break;
        }
      }
    }

    // Build update data
    const updateData: Prisma.ExpenseUpdateInput = {};

    if (title !== undefined) updateData.title = title;
    if (amount !== undefined) updateData.amount = amount;
    if (categoryId !== undefined) updateData.category = { connect: { id: categoryId } };
    if (labelId !== undefined) {
      await assertLabelVisible(userId, labelId);
      updateData.label = { connect: { id: labelId } };
    }
    if (paidById !== undefined) updateData.paidBy = { connect: { id: paidById } };
    if (notes !== undefined) updateData.notes = notes || null;
    if (expenseDate !== undefined) updateData.expenseDate = new Date(expenseDate);
    if (splitType !== undefined) updateData.splitType = splitType;

    // Handle split changes
    if (splitWithIds !== undefined) {
      updateData.splitWith = { set: splitWithIds.map((id) => ({ id })) };
    }

    if (finalSplitIds.length > 0) {
      // Persist whenever the split was (re)computed above - covers
      // amount-only, splitType-only, splitAmount-only, and
      // splitPercentage-only edits, not just splitWithIds changes.
      updateData.splitAmount = finalSplitAmounts;
      if (finalSplitPercentage !== undefined) {
        updateData.splitPercentage = finalSplitPercentage;
      }
    } else if (splitWithIds !== undefined) {
      // splitWithIds explicitly cleared to an empty split
      updateData.splitAmount = [];
      updateData.splitPercentage = [];
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

/**
 * Fuzzy-match a typed expense title against the user's own past expenses,
 * globally across all of that user's groups (R5, KTD4 -- not scoped to the
 * group/theme currently being edited).
 *
 * Authorization mirrors getLabelTotals's accessibleGroups pattern: a user
 * can only ever see expenses from groups they are a member of or created,
 * even when another group has a textually identical title.
 *
 * @param userId - The current user ID
 * @param titleQuery - The partial/full title text typed so far
 * @returns Up to SUGGESTION_LIMIT ranked matches with a date-free prefill payload
 */
export async function findSimilarExpenses(
  userId: number,
  titleQuery: string
): Promise<SimilarExpenseMatch[]> {
  try {
    const accessibleGroups = await prisma.group.findMany({
      where: { OR: [{ createdById: userId }, { members: { some: { id: userId } } }] },
      select: { id: true },
    });
    const accessibleGroupIds = accessibleGroups.map((g) => g.id);

    if (accessibleGroupIds.length === 0) {
      return [];
    }

    const candidates = await prisma.expense.findMany({
      where: { groupId: { in: accessibleGroupIds } },
      include: { splitWith: { select: { id: true } } },
    });

    const ranked = rankMatches(titleQuery, candidates, (expense) => expense.title, SUGGESTION_LIMIT);

    return ranked.map(({ item }) => ({
      expenseId: item.id,
      title: item.title,
      amount: item.amount,
      categoryId: item.categoryId,
      splitWithIds: item.splitWith.map((member: { id: number }) => member.id),
    }));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'EXPENSE.SUGGEST_FAILED',
      500,
      'SUGGEST_EXPENSES_ERROR',
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Resolve a keyword-dictionary category suggestion (R8) into a category id
 * the given user can actually see (KTD7's userId-null-or-own visibility
 * model), falling back to null (caller then falls back to "Other" per
 * KTD8) when the dictionary has no match or the matched category code
 * isn't visible to this user.
 *
 * @param userId - The current user ID
 * @param titleQuery - The expense title text to run through the dictionary
 */
export async function suggestCategoryForTitle(
  userId: number,
  titleQuery: string
): Promise<{ categoryId: number; code: string } | null> {
  const code = suggestCategoryCode(titleQuery);

  if (!code) {
    return null;
  }

  try {
    const category = await prisma.category.findFirst({
      where: { code, isActive: true, OR: [{ userId: null }, { userId }] },
    });

    return category ? { categoryId: category.id, code: category.code } : null;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'EXPENSE.SUGGEST_CATEGORY_FAILED',
      500,
      'SUGGEST_CATEGORY_ERROR',
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}
