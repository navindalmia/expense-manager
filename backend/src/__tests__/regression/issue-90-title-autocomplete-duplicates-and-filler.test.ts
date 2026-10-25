/**
 * Issue #89 (placeholder number -- rename once the tracking issue is filed):
 * title autocomplete listed duplicate past titles and surfaced irrelevant
 * suggestions that only shared a filler word ("to", "the").
 */

import * as expenseService from '../../services/expenseService';
import { rankMatches, scoreMatch } from '../../lib/fuzzyMatch';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

interface PastExpense {
  id: number;
  title: string;
  amount: number;
  categoryId: number;
  expenseDate: Date;
  splitWith: { id: number }[];
}

function past(id: number, title: string, date: string): PastExpense {
  return { id, title, amount: 10, categoryId: 1, expenseDate: new Date(date), splitWith: [] };
}

describe('issue-89: autocomplete dedup and filler-word matching', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
  });

  it('should collapse repeated titles to the most recent expense', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      past(1, 'Dinner', '2026-01-01'),
      past(3, 'Dinner', '2026-03-01'),
      past(2, 'dinner ', '2026-02-01'),
    ]);

    const result = await expenseService.findSimilarExpenses(1, 'Dinner');

    expect(result).toHaveLength(1);
    expect(result[0]?.expenseId).toBe(3);
  });

  it('should still return a distinct matching title alongside the deduped one', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      past(1, 'Dinner', '2026-01-01'),
      past(2, 'Dinner', '2026-02-01'),
      past(3, 'Dinner out', '2026-02-02'),
    ]);

    const result = await expenseService.findSimilarExpenses(1, 'Dinner');

    expect(result.map((r) => r.title).sort()).toEqual(['Dinner', 'Dinner out']);
  });

  it('should not surface a title that only shares a filler word', () => {
    expect(scoreMatch('pay to john', 'Taxi to airport')).toBe(0);
    expect(rankMatches('to', [{ t: 'Taxi to airport' }], (i) => i.t, 5)).toEqual([]);
  });

  it('should surface a title sharing a distinctive word', () => {
    expect(scoreMatch('airport', 'Taxi to airport')).toBeGreaterThan(0);
  });
});
