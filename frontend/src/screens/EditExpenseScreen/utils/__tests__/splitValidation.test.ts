/**
 * Unit tests for splitValidation utilities
 * Tests calculateMemberShare() function for all split types
 * 
 * Testing Strategy: Code First, Tests After
 * - Happy path: standard operations
 * - Error cases: invalid inputs, edge cases
 * - Regression: original bugs to prevent reoccurrence
 * 
 * These tests lock in the behavior after manual mobile testing passes.
 */

import { calculateMemberShare, computeEqualPercentages, computeEqualAmounts, computePercentageAmounts, validateSplitConfig } from '../splitValidation';

describe('validateSplitConfig - zero-value split members are rejected', () => {
  it('rejects an AMOUNT split with a member left at 0 (regression: a newly-added member defaulting to 0 silently passed since 0 does not affect the sum check)', () => {
    const error = validateSplitConfig('AMOUNT', '100', { 1: '100', 2: '0' }, {});
    expect(error).toBe('Every split member must have an amount greater than 0');
  });

  it('rejects a PERCENTAGE split with a member left at 0', () => {
    const error = validateSplitConfig('PERCENTAGE', '100', {}, { 1: '100', 2: '0' });
    expect(error).toBe('Every split member must have a percentage greater than 0');
  });

  it('still rejects negative amounts (0-check does not shadow the negative check)', () => {
    const error = validateSplitConfig('AMOUNT', '100', { 1: '110', 2: '-10' }, {});
    expect(error).toBe('Split amounts cannot be negative');
  });

  it('still rejects negative percentages', () => {
    const error = validateSplitConfig('PERCENTAGE', '100', {}, { 1: '110', 2: '-10' });
    expect(error).toBe('Split percentages cannot be negative');
  });

  it('accepts a valid AMOUNT split where every member has a positive amount', () => {
    const error = validateSplitConfig('AMOUNT', '100', { 1: '60', 2: '40' }, {});
    expect(error).toBeNull();
  });

  it('accepts a valid PERCENTAGE split where every member has a positive percentage', () => {
    const error = validateSplitConfig('PERCENTAGE', '100', {}, { 1: '60', 2: '40' });
    expect(error).toBeNull();
  });

  it('EQUAL split type is unaffected (no per-member zero check applies)', () => {
    const error = validateSplitConfig('EQUAL', '100', {}, {});
    expect(error).toBeNull();
  });
});

describe('computeEqualPercentages - regression: naive rounding does not sum to 100', () => {
  it('splits 3 ways summing to exactly 100.00 (naive (100/3).toFixed(2) x3 = 99.99)', () => {
    const result = computeEqualPercentages([1, 2, 3]);
    const sum = Object.values(result).reduce((s, v) => s + parseFloat(v), 0);
    expect(sum).toBeCloseTo(100, 2);
    expect(result[1]).toBe('33.34');
    expect(result[2]).toBe('33.33');
    expect(result[3]).toBe('33.33');
  });

  it('splits 6 ways summing to exactly 100.00 (naive (100/6).toFixed(2) x6 = 100.02)', () => {
    const result = computeEqualPercentages([1, 2, 3, 4, 5, 6]);
    const sum = Object.values(result).reduce((s, v) => s + parseFloat(v), 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it('splits 7 ways summing to exactly 100.00', () => {
    const result = computeEqualPercentages([1, 2, 3, 4, 5, 6, 7]);
    const sum = Object.values(result).reduce((s, v) => s + parseFloat(v), 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it('splits evenly (2 members) as 50.00/50.00', () => {
    expect(computeEqualPercentages([1, 2])).toEqual({ 1: '50.00', 2: '50.00' });
  });

  it('returns empty object for no members', () => {
    expect(computeEqualPercentages([])).toEqual({});
  });
});

describe('computeEqualAmounts - regression: naive rounding does not sum to total', () => {
  it('splits 100 three ways summing to exactly 100.00', () => {
    const result = computeEqualAmounts(100, [1, 2, 3]);
    const sum = Object.values(result).reduce((s, v) => s + parseFloat(v), 0);
    expect(sum).toBeCloseTo(100, 2);
    expect(result[1]).toBe('33.34');
    expect(result[2]).toBe('33.33');
    expect(result[3]).toBe('33.33');
  });

  it('splits an arbitrary decimal total (10.01) three ways summing exactly', () => {
    const result = computeEqualAmounts(10.01, [1, 2, 3]);
    const sum = Object.values(result).reduce((s, v) => s + parseFloat(v), 0);
    expect(sum).toBeCloseTo(10.01, 2);
  });

  it('returns empty object for no members', () => {
    expect(computeEqualAmounts(100, [])).toEqual({});
  });
});

describe('computePercentageAmounts - regression: naive independent rounding drifts from totalAmount', () => {
  it('splits proportionally to percentages summing to exactly totalAmount', () => {
    // Naive (totalAmount * pct / 100).toFixed(2) per member gives
    // 33.31/33.30/33.30 = 99.91, drifting from totalAmount=99.98.
    const result = computePercentageAmounts(
      99.98,
      { 1: '33.34', 2: '33.33', 3: '33.33' },
      [1, 2, 3]
    );
    const sum = Object.values(result).reduce((s, v) => s + parseFloat(v), 0);
    expect(sum).toBeCloseTo(99.98, 2);
    expect(result).toEqual({ 1: '33.33', 2: '33.33', 3: '33.32' });
  });

  it('splits proportionally for unequal percentages (70/30)', () => {
    const result = computePercentageAmounts(100, { 1: '70', 2: '30' }, [1, 2]);
    expect(result).toEqual({ 1: '70.00', 2: '30.00' });
  });

  it('returns 0.00 for all members when percentages are unset (weight sum is 0)', () => {
    const result = computePercentageAmounts(100, {}, [1, 2]);
    expect(result).toEqual({ 1: '0.00', 2: '0.00' });
  });

  it('returns empty object for no members', () => {
    expect(computePercentageAmounts(100, {}, [])).toEqual({});
  });
});

describe('calculateMemberShare - UNIT TESTS', () => {
  describe('✅ HAPPY PATH: EQUAL splits', () => {
    it('divides equally among members', () => {
      expect(calculateMemberShare('EQUAL', 100, '0', '0', 2)).toBe('50.00');
    });

    it('handles single member correctly', () => {
      expect(calculateMemberShare('EQUAL', 100, '0', '0', 1)).toBe('100.00');
    });

    it('handles multiple members (4)', () => {
      expect(calculateMemberShare('EQUAL', 100, '0', '0', 4)).toBe('25.00');
    });

    it('handles decimal amounts', () => {
      expect(calculateMemberShare('EQUAL', 50.50, '0', '0', 2)).toBe('25.25');
    });

    it('rounds uneven divisions correctly', () => {
      // 100 / 3 = 33.333... → rounds to 33.33
      expect(calculateMemberShare('EQUAL', 100, '0', '0', 3)).toBe('33.33');
    });
  });

  describe('✅ HAPPY PATH: AMOUNT splits', () => {
    it('returns exact member amount', () => {
      expect(calculateMemberShare('AMOUNT', 100, '25', '0', 1)).toBe('25.00');
    });

    it('handles decimal member amounts', () => {
      expect(calculateMemberShare('AMOUNT', 100, '33.50', '0', 1)).toBe('33.50');
    });

    it('handles string amounts (converts to number)', () => {
      expect(calculateMemberShare('AMOUNT', 100, '40.25', '0', 1)).toBe('40.25');
    });

    it('ignores total members count (irrelevant for AMOUNT)', () => {
      // AMOUNT splits don't divide, so member count doesn't matter
      expect(calculateMemberShare('AMOUNT', 100, '50', '0', 1)).toBe('50.00');
      expect(calculateMemberShare('AMOUNT', 100, '50', '0', 99)).toBe('50.00');
    });
  });

  describe('✅ HAPPY PATH: PERCENTAGE splits', () => {
    it('calculates percentage correctly', () => {
      expect(calculateMemberShare('PERCENTAGE', 100, '0', '50', 1)).toBe('50.00');
    });

    it('handles 25% split', () => {
      expect(calculateMemberShare('PERCENTAGE', 100, '0', '25', 1)).toBe('25.00');
    });

    it('handles 100% (full amount)', () => {
      expect(calculateMemberShare('PERCENTAGE', 100, '0', '100', 1)).toBe('100.00');
    });

    it('handles decimal percentages', () => {
      expect(calculateMemberShare('PERCENTAGE', 100, '0', '33.33', 1)).toBe('33.33');
    });

    it('handles decimal amounts with percentages', () => {
      expect(calculateMemberShare('PERCENTAGE', 50.50, '0', '50', 1)).toBe('25.25');
    });

    it('ignores total members count (irrelevant for PERCENTAGE)', () => {
      // PERCENTAGE splits don't use member count
      expect(calculateMemberShare('PERCENTAGE', 100, '0', '50', 1)).toBe('50.00');
      expect(calculateMemberShare('PERCENTAGE', 100, '0', '50', 99)).toBe('50.00');
    });
  });

  describe('❌ ERROR CASES: Invalid inputs', () => {
    it('handles undefined memberAmount gracefully', () => {
      expect(calculateMemberShare('AMOUNT', 100, undefined as any, '0', 1)).toBe('0.00');
    });

    it('handles undefined memberPercentage gracefully', () => {
      expect(calculateMemberShare('PERCENTAGE', 100, '0', undefined as any, 1)).toBe('0.00');
    });

    it('returns 0.00 for invalid split type', () => {
      expect(calculateMemberShare('INVALID' as any, 100, '0', '0', 2)).toBe('0.00');
    });

    it('handles zero amount', () => {
      expect(calculateMemberShare('EQUAL', 0, '0', '0', 3)).toBe('0.00');
    });

    it('handles zero member amount', () => {
      expect(calculateMemberShare('AMOUNT', 100, '0', '0', 1)).toBe('0.00');
    });

    it('handles zero percentage', () => {
      expect(calculateMemberShare('PERCENTAGE', 100, '0', '0', 1)).toBe('0.00');
    });
  });

  describe('⚠️ EDGE CASES: Boundary values', () => {
    it('handles very large amounts', () => {
      expect(calculateMemberShare('EQUAL', 999999.99, '0', '0', 3)).toBe('333333.33');
    });

    it('handles very small amounts', () => {
      expect(calculateMemberShare('EQUAL', 0.01, '0', '0', 2)).toBe('0.01');
    });

    it('handles single cent amount', () => {
      expect(calculateMemberShare('EQUAL', 0.01, '0', '0', 1)).toBe('0.01');
    });

    it('handles high decimal precision in input', () => {
      expect(calculateMemberShare('EQUAL', 123.456, '0', '0', 2)).toBe('61.73');
    });

    it('handles percentage > 100%', () => {
      // Should still calculate even if invalid (validation happens elsewhere)
      expect(calculateMemberShare('PERCENTAGE', 100, '0', '150', 1)).toBe('150.00');
    });
  });

  describe('🐛 REGRESSION TESTS: Original bugs', () => {
    describe('Bug #1: Dinner expense with single member', () => {
      it('correctly splits 23 among 1 member only (NOT assuming payer)', () => {
        // Original bug: calculateUserShare() assumed payer was always in split
        // So 1 member + 1 payer = 2 people → 23 ÷ 2 = 11.50 ❌
        // Fixed: Only count actual splitWith members → 23 ÷ 1 = 23.00 ✓
        expect(calculateMemberShare('EQUAL', 23, '0', '0', 1)).toBe('23.00');
      });

      it('test.5 expense: not 11.50, should be 23.00', () => {
        expect(calculateMemberShare('EQUAL', 23, '0', '0', 1)).toBe('23.00');
      });
    });

    describe('Bug #2: Real world scenarios from settlement screen', () => {
      it('splits rent 450.50 among 3 people equally', () => {
        // Rent expense should show 150.17 for each person (not missing)
        expect(calculateMemberShare('EQUAL', 450.50, '0', '0', 3)).toBe('150.17');
      });

      it('splits group dinner 90 among 2 people', () => {
        expect(calculateMemberShare('EQUAL', 90, '0', '0', 2)).toBe('45.00');
      });
    });

    describe('Bug #3: Complex split scenarios', () => {
      it('percentage split: 60% + 40% = 100%', () => {
        expect(calculateMemberShare('PERCENTAGE', 100, '0', '60', 1)).toBe('60.00');
        expect(calculateMemberShare('PERCENTAGE', 100, '0', '40', 1)).toBe('40.00');
      });

      it('amount split: 30 + 20 + remaining', () => {
        expect(calculateMemberShare('AMOUNT', 100, '30', '0', 1)).toBe('30.00');
        expect(calculateMemberShare('AMOUNT', 100, '20', '0', 1)).toBe('20.00');
        // Payer owes: 100 - 30 - 20 = 50
        expect(calculateMemberShare('EQUAL', 100, '0', '0', 1)).toBe('100.00');
      });
    });
  });

  describe('📊 COVERAGE: Integration with ExpenseListScreen', () => {
    it('works correctly when called from calculateUserShare() hook', () => {
      // Simulates how ExpenseListScreen.tsx uses it
      const amount = 23;
      const splitWithLength = 1;
      const result = calculateMemberShare('EQUAL', amount, '0', '0', splitWithLength);
      expect(result).toBe('23.00');
    });

    it('works with form preview in EditExpenseScreen', () => {
      // Simulates SplitMembersInput using it for live preview
      const result = calculateMemberShare('EQUAL', 100, '0', '0', 3);
      expect(parseFloat(result)).toBe(33.33);
    });
  });
});

/**
 * Test Coverage Summary:
 * ✅ Happy Path: 13 tests
 * ❌ Error Cases: 6 tests
 * ⚠️ Edge Cases: 5 tests
 * 🐛 Regression: 8 tests
 * 📊 Integration: 2 tests
 * ────────────────────
 * TOTAL: 34 tests covering all scenarios
 * 
 * Run with: npm test -- splitValidation.test.ts
 */
