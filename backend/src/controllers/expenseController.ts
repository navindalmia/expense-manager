// src/controllers/expenseController.ts
import { Request, Response, NextFunction } from "express";
import * as expenseService from "../services/expenseService";
import { createExpenseSchema, updateExpenseSchema } from "../schemas/expenseSchema";
import { SplitType } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";

export async function getExpenses(req: Request, res: Response) {
  const expenses = await expenseService.getAllExpenses();
  res.json(expenses);
}

/**
 * Get expenses for a specific group
 * GET /api/expenses/group/:groupId
 * 
 * Returns all active expenses for a given group with full relationships (currency, paidBy, category, splitWith).
 * Includes authorization check to ensure user is a member of the group.
 * 
 * Authenticated: Yes (requires JWT)
 * Authorization: User must be member or creator of the group
 * Response: { statusCode: 200, data: Expense[] }
 * 
 * Error Codes:
 * - 400: Missing or invalid groupId
 * - 403: User not authorized to view this group's expenses
 * - 404: Group not found
 * - 500: Internal server error
 */
export async function getGroupExpenses(req: Request, res: Response) {
  try {
    const groupIdParam = req.params.groupId;
    
    if (!groupIdParam) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Group ID is required',
      });
    }

    const groupId = parseInt(groupIdParam, 10);

    if (isNaN(groupId) || groupId <= 0) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Invalid group ID',
      });
    }

    // Get userId from JWT token (already authenticated by middleware)
    const userId = req.user!.id;

    // Fetch expenses with permission check
    const expenses = await expenseService.getGroupExpenses(groupId, userId);

    res.status(200).json({
      statusCode: 200,
      data: expenses,
    });
  } catch (err: any) {
    // Let error handler middleware manage all errors
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Failed to fetch group expenses:', err);
    throw new AppError('Failed to fetch expenses', 500, 'FETCH_ERROR', { error: err });
  }
}

export async function createExpense(req: Request, res: Response, next?: NextFunction) {
  try {
    // Get userId from JWT token via auth middleware
    const userId = req.user!.id;

    // Validate input using ZOD
    const parsed = createExpenseSchema.parse({
      ...req.body,
      paidById: userId, // Set paidBy from current user
    });

    // Convert into proper type
    const expenseData = {
      ...parsed,
      splitType: parsed.splitType as SplitType,
    } as Parameters<typeof expenseService.createExpense>[0];

    // Pass to service
    const expense = await expenseService.createExpense(expenseData);

    res.status(201).json({
      statusCode: 201,
      data: expense,
      message: 'Expense created successfully',
    });
  } catch (err) {
    // If next is provided (normal Express), use error middleware
    if (next) {
      // Validation errors from ZOD
      if (err instanceof ZodError) {
        return next(
          new AppError(
            'VALIDATION.ERROR',
            400,
            'VALIDATION_ERROR',
            { fields: err.issues }
          )
        );
      }
      // All other errors to error middleware
      next(err);
    } else {
      // Test mode - handle error manually
      if (err instanceof ZodError) {
        return res.status(400).json({
          statusCode: 400,
          error: 'Validation error',
          details: err.issues,
        });
      }
      console.error(err);
      return res.status(500).json({
        statusCode: 500,
        error: err instanceof Error ? err.message : 'Failed to create expense',
      });
    }
  }
}

/**
 * Delete an expense
 * DELETE /api/expenses/:id
 * 
 * Deletes an expense if the user is a member of the expense's group.
 * Includes authorization check to ensure user is a member of the expense's group.
 * 
 * Authenticated: Yes (requires JWT)
 * Authorization: User must be member or creator of the expense's group
 * Response: { statusCode: 204 }
 * 
 * Error Codes:
 * - 400: Invalid expense ID
 * - 403: User not authorized to delete this expense
 * - 404: Expense not found
 * - 500: Internal server error
 */
export async function deleteExpense(req: Request, res: Response, next?: NextFunction) {
  try {
    const expenseIdParam = req.params.id;

    if (!expenseIdParam) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Expense ID is required',
      });
    }

    const expenseId = parseInt(expenseIdParam, 10);

    if (isNaN(expenseId) || expenseId <= 0) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Invalid expense ID',
      });
    }

    const userId = req.user!.id;
    await expenseService.deleteExpense(expenseId, userId);

    res.status(204).send();
  } catch (err) {
    if (next) {
      next(err);
    } else {
      console.error(err);
      return res.status(500).json({
        statusCode: 500,
        error: err instanceof Error ? err.message : 'Failed to delete expense',
      });
    }
  }
}

/**
 * Get a single expense by ID
 * GET /api/expenses/:id
 * 
 * Returns a single expense with full relationships.
 * Includes authorization check to ensure user is a member of the expense's group.
 * 
 * Authenticated: Yes (requires JWT)
 * Authorization: User must be member or creator of the expense's group
 * Response: { statusCode: 200, data: Expense }
 * 
 * Error Codes:
 * - 400: Invalid expense ID
 * - 403: User not authorized to view this expense
 * - 404: Expense not found
 * - 500: Internal server error
 */
export async function getExpenseById(req: Request, res: Response, next?: NextFunction) {
  try {
    const expenseIdParam = req.params.id;

    if (!expenseIdParam) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Expense ID is required',
      });
    }

    const expenseId = parseInt(expenseIdParam, 10);

    if (isNaN(expenseId) || expenseId <= 0) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Invalid expense ID',
      });
    }

    const userId = req.user!.id;
    const expense = await expenseService.getExpenseById(expenseId, userId);

    res.status(200).json({
      statusCode: 200,
      data: expense,
    });
  } catch (err) {
    if (next) {
      next(err);
    } else {
      console.error(err);
      return res.status(500).json({
        statusCode: 500,
        error: err instanceof Error ? err.message : 'Failed to fetch expense',
      });
    }
  }
}

/**
 * Update an existing expense
 * PATCH /api/expenses/:id
 * 
 * Updates specified fields of an expense. Only the provided fields will be updated.
 * Includes authorization check to ensure user is a member of the expense's group.
 * 
 * Authenticated: Yes (requires JWT)
 * Authorization: User must be member or creator of the expense's group
 * Response: { statusCode: 200, data: UpdatedExpense, message: "..." }
 * 
 * Error Codes:
 * - 400: Invalid expense ID or validation error
 * - 403: User not authorized to edit this expense
 * - 404: Expense not found
 * - 500: Internal server error
 */
export async function updateExpense(req: Request, res: Response, next?: NextFunction) {
  try {
    const expenseIdParam = req.params.id;

    if (!expenseIdParam) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Expense ID is required',
      });
    }

    const expenseId = parseInt(expenseIdParam, 10);

    if (isNaN(expenseId) || expenseId <= 0) {
      return res.status(400).json({
        statusCode: 400,
        error: 'Invalid expense ID',
      });
    }

    // Validate input using Zod
    const parsed = updateExpenseSchema.parse(req.body);

    const userId = req.user!.id;

    // Cast splitType to SplitType if present
    const updateData = {
      ...parsed,
      splitType: parsed.splitType ? (parsed.splitType as SplitType) : undefined,
    };

    // Pass to service (partial update - only provided fields)
    const updatedExpense = await expenseService.updateExpense(expenseId, userId, updateData);

    res.status(200).json({
      statusCode: 200,
      data: updatedExpense,
      message: 'Expense updated successfully',
    });
  } catch (err) {
    if (next) {
      if (err instanceof ZodError) {
        return next(
          new AppError(
            'VALIDATION.ERROR',
            400,
            'VALIDATION_ERROR',
            { fields: err.issues }
          )
        );
      }
      next(err);
    } else {
      if (err instanceof ZodError) {
        return res.status(400).json({
          statusCode: 400,
          error: 'Validation error',
          details: err.issues,
        });
      }
      console.error(err);
      return res.status(500).json({
        statusCode: 500,
        error: err instanceof Error ? err.message : 'Failed to update expense',
      });
    }
  }
}
