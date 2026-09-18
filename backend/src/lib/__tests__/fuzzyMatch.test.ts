/**
 * Fuzzy Match Tests
 *
 * Pure input -> score logic, no Prisma mocking needed (KTD9).
 */

import { scoreMatch, rankMatches } from '../fuzzyMatch';

describe('fuzzyMatch', () => {
  describe('scoreMatch', () => {
    it('should score an exact match highest', () => {
      const exactScore = scoreMatch('Fuel', 'Fuel');
      const partialScore = scoreMatch('Fuel', 'Fuel top-up');

      expect(exactScore).toBeGreaterThan(partialScore);
    });

    it('should score a matching candidate higher than an unrelated one', () => {
      const matchingScore = scoreMatch('Fuel', 'Fuel');
      const unrelatedScore = scoreMatch('Fuel', 'Furniture');

      expect(matchingScore).toBeGreaterThan(unrelatedScore);
    });

    it('should return 0 when the query is an empty string', () => {
      expect(scoreMatch('', 'Fuel')).toBe(0);
    });

    it('should not crash on a single-character query', () => {
      expect(() => scoreMatch('F', 'Fuel')).not.toThrow();
      expect(scoreMatch('F', 'Fuel')).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 when there is no token overlap at all', () => {
      expect(scoreMatch('Groceries', 'Taxi fare')).toBe(0);
    });

    it('should return 0 when the candidate is an empty/whitespace-only string', () => {
      expect(scoreMatch('Fuel', '   ')).toBe(0);
    });
  });

  describe('rankMatches', () => {
    it('should rank items by score, highest first', () => {
      const items = [{ title: 'Furniture' }, { title: 'Fuel' }, { title: 'Fuel top-up' }];

      const ranked = rankMatches('Fuel', items, (item) => item.title, 5);

      expect(ranked.map((r) => r.item.title)).toEqual(['Fuel', 'Fuel top-up']);
    });

    it('should respect the limit', () => {
      const items = [{ title: 'Fuel' }, { title: 'Fuel A' }, { title: 'Fuel B' }, { title: 'Fuel C' }];

      const ranked = rankMatches('Fuel', items, (item) => item.title, 2);

      expect(ranked).toHaveLength(2);
    });

    it('should return an empty array when nothing overlaps', () => {
      const items = [{ title: 'Groceries' }, { title: 'Taxi fare' }];

      const ranked = rankMatches('Fuel', items, (item) => item.title, 5);

      expect(ranked).toEqual([]);
    });
  });
});
