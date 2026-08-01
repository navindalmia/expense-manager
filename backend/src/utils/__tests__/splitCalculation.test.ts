/**
 * Split Calculation Tests
 *
 * Regression: naive (amount/N).toFixed(2) repeated N times does not sum
 * back to amount for most N, silently under/overstating the recorded
 * split total (e.g. 100/3 = 33.33 x3 = 99.99, losing 1 cent).
 */

import { distributeAmountEvenly } from '../splitCalculation';

describe('distributeAmountEvenly', () => {
  it('splits 100 three ways summing to exactly 100 (naive division loses 1 cent)', () => {
    const result = distributeAmountEvenly(100, 3);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 2);
    expect(result).toEqual([33.34, 33.33, 33.33]);
  });

  it('splits 100 six ways summing to exactly 100 (naive division overshoots)', () => {
    const result = distributeAmountEvenly(100, 6);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it('splits 100 seven ways summing to exactly 100', () => {
    const result = distributeAmountEvenly(100, 7);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it('splits evenly (2 shares) as 50/50', () => {
    expect(distributeAmountEvenly(100, 2)).toEqual([50, 50]);
  });

  it('splits an arbitrary decimal total (10.01) three ways summing exactly', () => {
    const result = distributeAmountEvenly(10.01, 3);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(10.01, 2);
  });

  it('returns an empty array for zero shares', () => {
    expect(distributeAmountEvenly(100, 0)).toEqual([]);
  });

  it('returns an empty array for negative share count', () => {
    expect(distributeAmountEvenly(100, -1)).toEqual([]);
  });
});
