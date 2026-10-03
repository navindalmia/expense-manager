import { createExpenseSchema, updateExpenseSchema } from '../expenseSchema';

describe('updateExpenseSchema themeId', () => {
  it('should accept null to clear the theme', () => {
    expect(updateExpenseSchema.parse({ themeId: null }).themeId).toBeNull();
  });

  it('should accept a positive id and leave it undefined when omitted', () => {
    expect(updateExpenseSchema.parse({ themeId: 3 }).themeId).toBe(3);
    expect(updateExpenseSchema.parse({}).themeId).toBeUndefined();
  });

  it('should reject a non-positive themeId', () => {
    expect(updateExpenseSchema.safeParse({ themeId: 0 }).success).toBe(false);
  });
});

describe('createExpenseSchema themeId', () => {
  it('should still reject null on create', () => {
    const base = { title: 'x', amount: 1, groupId: 1, paidById: 1, categoryId: 1, expenseDate: '2026-01-01' };
    expect(createExpenseSchema.safeParse({ ...base, themeId: null }).success).toBe(false);
  });
});
