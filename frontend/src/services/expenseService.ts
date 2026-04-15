/**
 * Expense Service
 * 
 * Service layer for expense management.
 * Abstracts HTTP calls to backend /api/expenses endpoints.
 * Screens import these functions instead of calling HTTP directly.
 */

import { http } from '../api/http';

/**
 * User entity from backend.
 * Represents a user who can pay for or split expenses.
 */
export interface User {
  id: number;
  name: string;
  email: string;
}

/**
 * Category entity from backend.
 * Categorizes expenses (e.g., FOOD, TRAVEL, ENTERTAINMENT).
 */
export interface Category {
  id: number;
  code: string;
  label: string;
}

/**
 * Expense entity as returned from backend.
 * Complete expense record with relationships (User, Category, splitWith).
 * Matches backend Prisma model with includes: paidBy, category, splitWith, currency.
 */
export interface Expense {
  id: number;
  title: string;
  amount: number;
  currency: {
    id: number;
    code: string;
    label: string;
  };
  paidById: number;
  paidBy: User;
  categoryId: number;
  category: Category;
  splitWith: User[];
  splitAmount: number[];
  splitPercentage: number[];
  splitType: string;
  notes?: string;
  expenseDate: string;
  createdAt: string;
  settled: boolean;
}

/**
 * Data Transfer Object (DTO) for creating expenses.
 * Defines the shape of data sent TO the backend.
 * Matches backend CreateExpenseSchema validation.
 * Optional fields get default values on backend (e.g., currency defaults to GBP).
 */
export interface CreateExpenseDTO {
  title: string;
  amount: number;
  currency?: string;
  paidById: number;
  categoryId: number;
  splitWithIds?: number[];
  splitType?: string;
  splitAmount?: number[];
  splitPercentage?: number[];
  notes?: string;
  expenseDate: string;
}

/**
 * Data Transfer Object (DTO) for updating expenses.
 * All fields are optional - only provided fields will be updated.
 * Allows partial updates to any field of the expense.
 */
export interface UpdateExpenseDTO {
  title?: string;
  amount?: number;
  categoryId?: number;
  paidById?: number;
  splitWithIds?: number[];
  splitType?: string;
  splitAmount?: number[];
  splitPercentage?: number[];
  notes?: string;
  expenseDate?: string;
}

/**
 * Fetch all expenses from backend.
 * DEPRECATED: Use getGroupExpenses() instead for group-scoped queries.
 * 
 * GET /api/expenses
 * 
 * @returns Promise<Expense[]> - Array of complete expense records with relationships
 * @throws AppError if request fails (translated error from backend)
 */
export async function getExpenses(): Promise<Expense[]> {
  const response = await http.get<Expense[]>('/expenses');
  return response.data;
}

/**
 * Fetch expenses for a specific group from backend.
 * PREFERRED: Use this for group-scoped expense queries.
 * 
 * GET /api/expenses/group/:groupId
 * 
 * @param groupId - Group ID to fetch expenses for
 * @returns Promise<Expense[]> - Array of expenses for that group only (no orphans)
 * @throws AppError if request fails
 */
export async function getGroupExpenses(groupId: number): Promise<Expense[]> {
  const response = await http.get<{ statusCode: number; data: Expense[] }>(`/expenses/group/${groupId}`);
  return response.data.data;
}

/**
 * Create new expense on backend.
 * Validates input data using Zod on backend before persistence.
 * Returns created expense with auto-generated id and createdAt timestamp.
 * 
 * POST /api/expenses
 * 
 * @param data - CreateExpenseDTO with expense details (required fields only)
 * @returns Promise<Expense> - Created expense with assigned id, timestamps, and relationships
 * @throws AppError if validation fails, database error, or user/category not found
 */
export async function createExpense(data: CreateExpenseDTO): Promise<Expense> {
  const response = await http.post<Expense>('/expenses', data);
  return response.data;
}

/**
 * Delete expense from backend.
 * Removes the expense record from database.
 * 
 * DELETE /api/expenses/:id
 * 
 * @param id - Expense ID to delete
 * @returns Promise<void> - No return value on success
 * @throws AppError if expense not found or deletion fails
 */
export async function deleteExpense(id: number): Promise<void> {
  await http.delete(`/expenses/${id}`);
}

/**
 * Fetch a single expense by ID from backend.
 * Includes full relationships (currency, paidBy, category, splitWith).
 * 
 * GET /api/expenses/:id
 * 
 * @param expenseId - The expense ID to fetch
 * @returns Promise<Expense> - Complete expense record with all relationships
 * @throws AppError if expense not found or user is not authorized
 */
export async function getExpenseById(expenseId: number): Promise<Expense> {
  const response = await http.get<{ statusCode: number; data: Expense }>(`/expenses/${expenseId}`);
  return response.data.data;
}

/**
 * Update an existing expense on backend.
 * Partially updates the expense with provided fields only.
 * Other fields remain unchanged.
 * 
 * PATCH /api/expenses/:id
 * 
 * @param expenseId - The expense ID to update
 * @param data - UpdateExpenseDTO with fields to update (all optional)
 * @returns Promise<Expense> - Updated expense record with all relationships
 * @throws AppError if validation fails, expense not found, or user is not authorized
 */
export async function updateExpense(expenseId: number, data: UpdateExpenseDTO): Promise<Expense> {
  const response = await http.patch<{ statusCode: number; data: Expense }>(`/expenses/${expenseId}`, data);
  return response.data.data;
}
