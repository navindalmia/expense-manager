/**
 * useExpenseForm Hook
 * Manages form input state (title, amount, category, paidById, notes, date)
 * Separates form UI state from business logic
 */

import { useState, useCallback } from 'react';
import type { Expense } from '../../../services/expenseService';

export interface FormState {
  title: string;
  amount: string;
  category: number | null;
  paidById: number | null;
  notes: string;
  date: string;
  tempDate: string;
  loading: boolean;
  errors: Record<string, string>;
}

interface UseExpenseFormReturn {
  formState: FormState;
  updateField: (field: keyof Omit<FormState, 'errors'>, value: any) => void;
  setError: (field: string, message: string) => void;
  clearErrors: () => void;
  prefillFromExpense: (expense: Expense) => void;
}

/**
 * Manage form input state for expense editing
 * @param initialExpense - Expense to pre-fill form with (optional)
 * @returns Form state and update functions
 */
export function useExpenseForm(initialExpense?: Expense | null): UseExpenseFormReturn {
  const [formState, setFormState] = useState<FormState>({
    title: initialExpense?.title || '',
    amount: initialExpense?.amount.toString() || '',
    category: initialExpense?.categoryId || null,
    paidById: initialExpense?.paidById || null,
    notes: initialExpense?.notes || '',
    date: initialExpense?.expenseDate.split('T')[0] || '',
    tempDate: initialExpense?.expenseDate.split('T')[0] || '',
    loading: false,
    errors: {},
  });

  const updateField = useCallback(
    (field: keyof Omit<FormState, 'errors'>, value: any) => {
      setFormState(prev => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const setError = useCallback((field: string, message: string) => {
    setFormState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: message,
      },
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      errors: {},
    }));
  }, []);

  const prefillFromExpense = useCallback((expense: Expense) => {
    const dateStr = expense.expenseDate.split('T')[0];
    setFormState(prev => ({
      ...prev,
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.categoryId,
      paidById: expense.paidById,
      notes: expense.notes || '',
      date: dateStr,
      tempDate: dateStr,
    }));
  }, []);

  return {
    formState,
    updateField,
    setError,
    clearErrors,
    prefillFromExpense,
  };
}
