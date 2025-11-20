
import { Currency, SplitType } from "./common";
import { User } from "./user";
import { Category } from "./category";

export interface Expense {
  id: number;
  title: string;
  amount: number;
  currency: Currency;
  paidById: number;
  paidBy?: User | null;
  splitWith?: User[];
  splitAmount?: number[];
  splitPercentage?: number[];
  splitType: SplitType;
  categoryId: number;
  category?: Category | null;
  notes?: string | null;
  expenseDate: string;
  createdAt?: string;
  settled?: boolean;
}

export interface CreateExpenseDTO {
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
}
