
import { z } from "zod";
import { SplitType } from "@prisma/client";

export const createExpenseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.number().positive("Amount must be positive"),
  groupId: z.number().int().positive("Invalid group ID"),
  
  currency: z.string().min(1, "Currency code is required"),
  splitType: z.enum(Object.values(SplitType) as [string, ...string[]]).default(SplitType.EQUAL),

  paidById: z.number().int().positive("Invalid payer ID"),
  categoryId: z.number().int().positive("Invalid category ID"),
  splitWithIds: z.array(z.number().int().positive()).optional().default([]),
  splitAmount: z.array(z.number().positive()).optional().default([]),
  splitPercentage: z.array(z.number().positive()).optional().default([]),
  notes: z.string().optional(),
  expenseDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/**
 * Schema for updating expenses (partial updates - all fields optional)
 */
export const updateExpenseSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  amount: z.number().positive("Amount must be positive").optional(),
  splitType: z.enum(Object.values(SplitType) as [string, ...string[]]).optional(),
  paidById: z.number().int().positive("Invalid payer ID").optional(),
  categoryId: z.number().int().positive("Invalid category ID").optional(),
  splitWithIds: z.array(z.number().int().positive()).optional(),
  splitAmount: z.array(z.number().positive()).optional(),
  splitPercentage: z.array(z.number().positive()).optional(),
  notes: z.string().optional(),
  expenseDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }).optional(),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
