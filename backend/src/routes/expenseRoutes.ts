// src/routes/expenseRoutes.ts
import { Router } from "express";
import { SplitType } from "../../src/generated/prisma";
import prisma from "../lib/prisma";
import {Prisma, Currency } from "@prisma/client";

const router = Router();
// const prisma = new PrismaClient();


/**
 * GET /api/expenses
 * Get all expenses
 */
router.get("/", async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        paidBy: true,
        category: true,
        splitWith: true,
      },
    });
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});
// Utility: remove undefined fields so Prisma won't throw validation errors
function cleanData<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T;
}


/**
 * POST /api/expenses
 * Add a new expense
 */router.post("/", async (req, res) => {
  try {
    const {
      title,
      amount,
      currency = Currency.GBP,
      paidById,
      categoryId,
      splitWithIds = [], // users sharing the expense
      splitType = SplitType.EQUAL,
      splitAmount = [],
      splitPercentage = [],
      notes,
      expenseDate,
    }: {
      title: string;
      amount: number;
      currency?: Currency;
      paidById: number;
      categoryId: number;
      splitWithIds?: number[];
      splitType?: SplitType;
      splitAmount?: number[];
      splitPercentage?: number[];
      notes?: string;
      expenseDate: string;
    } = req.body;

    // Calculate final split amounts
    let finalSplitAmounts: number[] = [];

    if (splitWithIds.length > 0) {
      switch (splitType) {
        case SplitType.EQUAL:
          const perPerson = parseFloat(
            (amount / splitWithIds.length).toFixed(2)
          );
          finalSplitAmounts = new Array(splitWithIds.length).fill(perPerson);
          break;

        case SplitType.AMOUNT:
          const sumAmount = splitAmount.reduce((a, b) => a + b, 0);
          if (sumAmount !== amount) {
            return res
              .status(400)
              .json({ error: "Sum of split amounts must equal total amount" });
          }
          finalSplitAmounts = splitAmount;
          break;

        case SplitType.PERCENTAGE:
          const sumPercentage = splitPercentage.reduce((a, b) => a + b, 0);
          if (sumPercentage !== 100) {
            return res
              .status(400)
              .json({ error: "Split percentages must add up to 100%" });
          }
          finalSplitAmounts = splitPercentage.map((p) =>
            parseFloat(((p / 100) * amount).toFixed(2))
          );
          break;
      }
    }

    // Create the expense
    const expense = await prisma.expense.create({
      data: cleanData({
        title,
        amount,
        currency,
        paidBy: { connect: { id: paidById } },
        category: { connect: { id: categoryId } },
        splitWith: { connect: splitWithIds.map((id) => ({ id })) },
        splitType,
        splitAmount: finalSplitAmounts,
        splitPercentage: splitType === SplitType.PERCENTAGE ? splitPercentage : [],
        notes,
        expenseDate: new Date(expenseDate),
      }) as Prisma.ExpenseCreateInput,
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create expense" });
  }
});


// router.post("/", async (req, res) => {
//   try {
//     const {
//       title,
//       amount,
//       currency,
//       paidById,
//       categoryId,
//       splitWithIds = [],
//       splitType = "EQUAL",
//       splitAmount = [],
//       splitPercentage = [],
//       notes,
//       expenseDate,
//     } = req.body;

//     const expense = await prisma.expense.create({
//       data: {
//         title,
//         amount,
//         currency,
//         paidBy: { connect: { id: paidById } },
//         category: { connect: { id: categoryId } },
//         splitWith: { connect: splitWithIds.map((id: number) => ({ id })) },
//         splitType,
//         splitAmount,
//         splitPercentage,
//         notes,
//         expenseDate: new Date(expenseDate),
//       },
//     });

//     res.status(201).json(expense);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to create expense" });
//   }
// });

/**
 * DELETE /api/expenses/:id
 * Delete an expense by ID
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.expense.delete({ where: { id: Number(id) } });
    res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

export default router;
