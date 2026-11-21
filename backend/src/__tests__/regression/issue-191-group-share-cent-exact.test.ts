/**
 * Issue #191: the per-member share shown on group cards divided the amount
 * without cent correction (100 / 3 = 33.333...), so members' shares did not add
 * back to the expense. Shares now come from utils/splitCalculation, the same
 * distribution createExpense persists.
 *
 * Behaviour change is limited to rounding remainders: amounts that divide
 * into whole cents are unchanged (pinned in groupService.characterization).
 */

import * as groupService from '../../services/groupService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

const PAYER = 1;
const SPLIT_WITH = [{ id: 1 }, { id: 2 }, { id: 3 }];

async function personalTotal(
  expense: {
    amount: number;
    splitType: 'EQUAL' | 'AMOUNT' | 'PERCENTAGE';
    splitPercentage: number[] | null;
  },
  userId: number
): Promise<number> {
  (prisma.group.findMany as jest.Mock).mockResolvedValue([
    {
      id: 1,
      createdById: PAYER,
      members: SPLIT_WITH,
      expenses: [{ ...expense, paidById: PAYER, splitWith: SPLIT_WITH, splitAmount: null }],
    },
  ]);
  return (await groupService.getUserGroups(userId))[0]!.userPersonalTotal;
}

describe('group share math is cent-exact (issue #191)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should give the leftover cent to the first member when 100.00 is split equally three ways', async () => {
    const expense = { amount: 100, splitType: 'EQUAL' as const, splitPercentage: null };

    expect(await personalTotal(expense, 1)).toBe(33.34);
    expect(await personalTotal(expense, 2)).toBe(33.33);
    expect(await personalTotal(expense, 3)).toBe(33.33);
  });

  it('should make equal shares add back to the expense amount', async () => {
    const expense = { amount: 100, splitType: 'EQUAL' as const, splitPercentage: null };
    const shares = [await personalTotal(expense, 1), await personalTotal(expense, 2), await personalTotal(expense, 3)];

    expect(Math.round(shares.reduce((a, b) => a + b, 0) * 100)).toBe(10000);
  });

  it('should round percentage shares to whole cents that add back to the amount', async () => {
    const expense = { amount: 100, splitType: 'PERCENTAGE' as const, splitPercentage: [33.33, 33.33, 33.34] };
    const shares = [await personalTotal(expense, 1), await personalTotal(expense, 2), await personalTotal(expense, 3)];

    shares.forEach((share) => expect(share * 100).toBeCloseTo(Math.round(share * 100), 6));
    expect(Math.round(shares.reduce((a, b) => a + b, 0) * 100)).toBe(10000);
  });
});
