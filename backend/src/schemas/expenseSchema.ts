
import { z } from "zod";
import { Currency, SplitType } from "@prisma/client";

export const createExpenseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.number().positive("Amount must be positive"),
  
  
  currency: z.enum(Object.values(Currency) as [string, ...string[]]).default(Currency.GBP),
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
