/**
 * Expense Service
 * 
 * Business logic for managing expenses within groups.
 * Handles creation, retrieval, deletion with validation.
 */

import prisma from "../lib/prisma";
import { Currency, SplitType, Prisma } from "@prisma/client";
import { cleanData } from "../utils/cleanData";
import { AppError } from "../errors/AppError";

/**
 * Get all expenses for a group (NEW - group-scoped)
 */
export async function getGroupExpenses(groupId: number) {
  try {
    const expenses = await prisma.expense.findMany({
      where: {
        groupId,
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
    throw new Error('Failed to fetch expenses');
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
  currency?: Currency;
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
    currency = Currency.GBP,
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
        const perPerson = parseFloat((amount / (splitWithIds.length + 1)).toFixed(2));
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
      throw new Error('Group not found');
    }

    // Verify paidById user is a member of the group
    const isPayerMember = group.members.some((m) => m.id === paidById);
    if (!isPayerMember && group.createdById !== paidById) {
      throw new Error('Payer is not a member of this group');
    }

    return prisma.expense.create({
      data: cleanData({
        title,
        amount,
        currency,
        group: { connect: { id: groupId } },
        paidBy: { connect: { id: paidById } },
        category: { connect: { id: categoryId } },
        splitWith: { connect: splitWithIds.map((id) => ({ id })) },
        splitType,
        splitAmount: finalSplitAmounts,
        splitPercentage: splitType === SplitType.PERCENTAGE ? splitPercentage : [],
        notes,
        expenseDate: new Date(expenseDate),
      }) as unknown as Prisma.ExpenseCreateInput,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new Error('Related record not found');
      }
    }
    throw error;
  }
}

export async function deleteExpense(id: number) {
  return prisma.expense.delete({ where: { id } });
}
