/**
 * Issue #175: the suggestion payload must carry the past expense's label and
 * theme so selecting a suggestion can autofill them (date is still omitted).
 */

import * as expenseService from '../../services/expenseService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

describe('issue-175: suggestion payload carries label and theme', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
  });

  it('should include labelId and themeId, but not the date, for each match', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      { id: 5, title: 'Dinner at Luigi', amount: 25, categoryId: 2, labelId: 3, themeId: 4, expenseDate: new Date('2026-01-01'), splitWith: [] },
      { id: 6, title: 'Dinner out', amount: 10, categoryId: 2, labelId: null, themeId: null, expenseDate: new Date('2026-01-02'), splitWith: [] },
    ]);

    const result = await expenseService.findSimilarExpenses(1, 'Dinner');

    const luigi = result.find((r) => r.expenseId === 5);
    const out = result.find((r) => r.expenseId === 6);
    expect(luigi).toMatchObject({ labelId: 3, themeId: 4 });
    expect(out).toMatchObject({ labelId: null, themeId: null });
    expect(luigi).not.toHaveProperty('expenseDate');
    expect(
      (prisma.expense.findMany as jest.Mock).mock.calls[0][0].select
    ).toMatchObject({ labelId: true, themeId: true });
  });
});
