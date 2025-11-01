// // src/services/expenseService.ts
// import prisma from "../lib/prisma";
// import { Currency, SplitType, Prisma } from "@prisma/client";
// import { cleanData } from "../utils/cleanData";
// import { AppError } from "../errors/AppError";
// import { errorMessages } from "../errors/errorMessages";

// export async function getAllExpenses() {
//   return prisma.expense.findMany({
//     include: {
//       paidBy: true,
//       category: true,
//       splitWith: true,
//     },
//   });
// }

// export async function createExpense(data: {
//   title: string;
//   amount: number;
//   currency?: Currency;
//   paidById: number;
//   categoryId: number;
//   splitWithIds?: number[];
//   splitType?: SplitType;
//   splitAmount?: number[];
//   splitPercentage?: number[];
//   notes?: string;
//   expenseDate: string;
// }) {
//   const {
//     title,
//     amount,
//     currency = Currency.GBP,
//     paidById,
//     categoryId,
//     splitWithIds = [],
//     splitType = SplitType.EQUAL,
//     splitAmount = [],
//     splitPercentage = [],
//     notes,
//     expenseDate,
//   } = data;

//   // Calculate final split
//   let finalSplitAmounts: number[] = [];

//   if (splitWithIds.length > 0) {
//     switch (splitType) {
//       case SplitType.EQUAL:
//         const perPerson = parseFloat((amount / splitWithIds.length).toFixed(2));
//         finalSplitAmounts = new Array(splitWithIds.length).fill(perPerson);
//         break;
//       case SplitType.AMOUNT:
//         const sumAmount = splitAmount.reduce((a, b) => a + b, 0);
//         if (sumAmount !== amount)
//           // throw new Error("Sum of split amounts must equal total amount");
//           throw new AppError(errorMessages.EXPENSE.SPLIT_SUM_MISMATCH, 400, "EXPENSE_SPLIT_INVALID");
//         finalSplitAmounts = splitAmount;
//         break;
//       case SplitType.PERCENTAGE:
//         const sumPercentage = splitPercentage.reduce((a, b) => a + b, 0);
//         if (sumPercentage !== 100)
//           // throw new Error("Split percentages must add up to 100%");
//          throw new AppError(errorMessages.EXPENSE.SPLIT_PERCENTAGE_INVALID, 400, "EXPENSE_PERCENT_INVALID");
        
//         finalSplitAmounts = splitPercentage.map((p) =>
//           parseFloat(((p / 100) * amount).toFixed(2))
//         );
//         break;
//     }
//   }

//   //  Create the expense
//   return prisma.expense.create({
//     data: cleanData({
//       title,
//       amount,
//       currency,
//       paidBy: { connect: { id: paidById } },
//       category: { connect: { id: categoryId } },
//       splitWith: { connect: splitWithIds.map((id) => ({ id })) },
//       splitType,
//       splitAmount: finalSplitAmounts,
//       splitPercentage:
//         splitType === SplitType.PERCENTAGE ? splitPercentage : [],
//       notes,
//       expenseDate: new Date(expenseDate),
//     }) as Prisma.ExpenseCreateInput,
//   });
// }

// export async function deleteExpense(id: number) {
//   return prisma.expense.delete({ where: { id } });
// }


import prisma from "../lib/prisma";
import { Currency, SplitType, Prisma } from "@prisma/client";
import { cleanData } from "../utils/cleanData";
import { AppError } from "../errors/AppError";

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
    paidById,
    categoryId,
    splitWithIds = [],
    splitType = SplitType.EQUAL,
    splitAmount = [],
    splitPercentage = [],
    notes,
    expenseDate,
  } = data;

  let finalSplitAmounts: number[] = [];

  if (splitWithIds.length > 0) {
    switch (splitType) {
      case SplitType.EQUAL:
        const perPerson = parseFloat((amount / splitWithIds.length).toFixed(2));
        finalSplitAmounts = new Array(splitWithIds.length).fill(perPerson);
        break;

      case SplitType.AMOUNT:
        const sumAmount = splitAmount.reduce((a, b) => a + b, 0);
        console.log("error in service");
        if (sumAmount !== amount)
          throw new AppError("EXPENSE.SPLIT_SUM_MISMATCH", 400, "EXPENSE_SPLIT_INVALID");
        finalSplitAmounts = splitAmount;
        break;

      case SplitType.PERCENTAGE:
        const sumPercentage = splitPercentage.reduce((a, b) => a + b, 0);
        if (sumPercentage !== 100)
          throw new AppError("EXPENSE.SPLIT_PERCENTAGE_INVALID", 400, "EXPENSE_PERCENT_INVALID");

        finalSplitAmounts = splitPercentage.map((p) =>
          parseFloat(((p / 100) * amount).toFixed(2))
        );
        break;
    }
  }

  return prisma.expense.create({
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
}

export async function deleteExpense(id: number) {
  return prisma.expense.delete({ where: { id } });
}
