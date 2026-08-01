/**
 * Utility: distribute an amount evenly across N shares without losing cents
 * to rounding. Naive (amount/N).toFixed(2) repeated N times does not sum
 * back to amount for most N (e.g. 100/3 = 33.33 x3 = 99.99). This divides
 * in integer cents and gives the leftover cent(s) to the first shares.
 */
export function distributeAmountEvenly(amount: number, n: number): number[] {
  if (n <= 0) return [];

  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / n);
  const remainderCents = totalCents - baseCents * n;

  return Array.from({ length: n }, (_, index) =>
    (baseCents + (index < remainderCents ? 1 : 0)) / 100
  );
}

/**
 * True if any value is not strictly positive (zero or negative). Used to
 * reject individual split amounts/percentages that a sum-only check (e.g.
 * "must sum to 100") would miss - [150, -50] sums to 100 but -50 is a
 * financially nonsensical negative share.
 */
export function hasNonPositiveValue(values: number[]): boolean {
  return values.some((v) => v <= 0);
}

/**
 * Distribute an amount across shares proportional to the given weights
 * (e.g. percentages), rounded to whole cents, guaranteed to sum back to
 * amount. Naive independent rounding of each share - parseFloat(((w/sum)*
 * amount).toFixed(2)) per weight - does not sum back to amount for most
 * inputs (e.g. 100 split 33.33/33.33/33.34% independently rounds to
 * 33.33/33.33/33.34 = 100.00, fine, but 33.34/33.33/33.33% on amount=99.98
 * can drift by a cent or two depending on the weights). Uses the largest-
 * remainder method: floor each proportional share, then give the leftover
 * cent(s) to the shares with the largest fractional remainder.
 */
export function distributeAmountByWeights(amount: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const totalCents = Math.round(amount * 100);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  if (weightSum <= 0) return new Array(n).fill(0);

  const rawShares = weights.map((w) => (w / weightSum) * totalCents);
  const flooredCents = rawShares.map((share) => Math.floor(share));
  const distributedCents = flooredCents.reduce((a, b) => a + b, 0);
  let remainderCents = totalCents - distributedCents;

  const order = rawShares
    .map((share, index) => ({ index, fraction: share - (flooredCents[index] ?? 0) }))
    .sort((a, b) => b.fraction - a.fraction);

  const resultCents = [...flooredCents];
  for (const { index } of order) {
    if (remainderCents <= 0) break;
    resultCents[index] = (resultCents[index] ?? 0) + 1;
    remainderCents -= 1;
  }

  return resultCents.map((cents) => cents / 100);
}
