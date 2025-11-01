// src/controllers/expenseController.ts
import { Request, Response } from "express";
import * as expenseService from "../services/expenseService";
import { createExpenseSchema } from "../schemas/expenseSchema";
import { Currency, SplitType } from "@prisma/client";


export async function getExpenses(req: Request, res: Response) {
  // try {
    const expenses = await expenseService.getAllExpenses();
    res.json(expenses);
  // } catch (err) {
  //   console.error(err);
  //   res.status(500).json({ error: "Failed to fetch expenses" });
  // }
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
    }as Parameters<typeof expenseService.createExpense>[0];

    //  Pass to service
    const expense = await expenseService.createExpense(cleanData);
    res.status(201).json(expense);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: err.errors });
    }
    console.error(err);
    // res.status(400).json({ error: err.message || "Failed to create expense" });
    throw err;
  }
}

export async function deleteExpense(req: Request, res: Response) {
  // try {
    const id = Number(req.params.id);
    await expenseService.deleteExpense(id);
    res.json({ message: "Expense deleted successfully" });
  // } catch (err) {
  //   console.error(err);
  //   res.status(500).json({ error: "Failed to delete expense" });
  // }
}


/*
import { Request, Response } from "express";
import * as expenseService from "../services/expenseService";

export async function getExpenses(req: Request, res: Response) {
  try {
    const expenses = await expenseService.getAllExpenses();
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
}

export async function createExpense(req: Request, res: Response) {
  try {
    const expense = await expenseService.createExpense(req.body);
    res.status(201).json(expense);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to create expense" });
  }
}

export async function deleteExpense(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await expenseService.deleteExpense(id);
    res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete expense" });
  }
}
*/