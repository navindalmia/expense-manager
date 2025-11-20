// src/controllers/expenseController.ts
import { Request, Response } from "express";
import * as expenseService from "../services/expenseService";
import { createExpenseSchema } from "../schemas/expenseSchema";
import { Currency, SplitType } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";

export async function getExpenses(req: Request, res: Response) {

  const expenses = await expenseService.getAllExpenses();
  res.json(expenses);

}

export async function createExpense(req: Request, res: Response) {
  try {
    //  Validate input using ZOD
    const parsed = createExpenseSchema.parse(req.body);
    // Convert into enum types
    const cleanData = {
      ...parsed,
      currency: parsed.currency as Currency,
      splitType: parsed.splitType as SplitType,
    } as Parameters<typeof expenseService.createExpense>[0];

    //  Pass to service
    const expense = await expenseService.createExpense(cleanData);
    res.status(201).json(expense);
  } catch (err: any) {
    // if (err.name === "ZodError") {
    //   return res.status(400).json({ error: err.errors });
    // }
    console.error(err);
    if (err instanceof ZodError) {
      throw new AppError(
        "VALIDATION.ERROR",       // translation message key
        400,                      // status
        "VALIDATION_ERROR",       // stable code
        { fields: err.issues }    // <— client can display per-field errors
      );
    }

    throw err;
  }
}

export async function deleteExpense(req: Request, res: Response) {
  // try {
  const id = Number(req.params.id);
  await expenseService.deleteExpense(id);
  res.json({ message: "Expense deleted successfully" });

}
