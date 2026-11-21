import { SplitType } from '@prisma/client';
import { resolveSplit } from '../expenseSplit';

const base = { amount: 100, memberCount: 3, splitAmount: [] as number[], splitPercentage: [] as number[] };

describe('resolveSplit', () => {
  it('should distribute an EQUAL split cent-exactly across the members', () => {
    const result = resolveSplit({ ...base, splitType: SplitType.EQUAL });

    expect(result.amounts).toEqual([33.34, 33.33, 33.33]);
    expect(result.percentages).toBeUndefined();
  });

  it('should return AMOUNT shares unchanged when they sum to the total within tolerance', () => {
    const result = resolveSplit({ ...base, splitType: SplitType.AMOUNT, splitAmount: [60, 40.005] });

    expect(result.amounts).toEqual([60, 40.005]);
  });

  it('should reject AMOUNT shares that do not sum to the total with SPLIT_SUM_MISMATCH', () => {
    expect(() => resolveSplit({ ...base, splitType: SplitType.AMOUNT, splitAmount: [60, 30] })).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'EXPENSE_SPLIT_INVALID', messageKey: 'EXPENSE.SPLIT_SUM_MISMATCH' })
    );
  });

  it('should reject a zero or negative AMOUNT share even when the sum matches', () => {
    expect(() => resolveSplit({ ...base, splitType: SplitType.AMOUNT, splitAmount: [150, -50] })).toThrow(
      expect.objectContaining({ code: 'EXPENSE_SPLIT_INVALID', messageKey: 'EXPENSE.SPLIT_AMOUNT_INVALID' })
    );
  });

  it('should convert PERCENTAGE shares to amounts and echo the percentages', () => {
    const result = resolveSplit({ ...base, splitType: SplitType.PERCENTAGE, memberCount: 2, splitPercentage: [25, 75] });

    expect(result).toEqual({ amounts: [25, 75], percentages: [25, 75] });
  });

  it('should reject PERCENTAGE shares that do not total 100', () => {
    expect(() =>
      resolveSplit({ ...base, splitType: SplitType.PERCENTAGE, memberCount: 2, splitPercentage: [50, 40] })
    ).toThrow(expect.objectContaining({ statusCode: 400, code: 'EXPENSE_PERCENT_INVALID' }));
  });

  it('should reject a non-positive PERCENTAGE entry even when the total is 100', () => {
    expect(() =>
      resolveSplit({ ...base, splitType: SplitType.PERCENTAGE, memberCount: 2, splitPercentage: [120, -20] })
    ).toThrow(expect.objectContaining({ code: 'EXPENSE_PERCENT_INVALID' }));
  });
});
