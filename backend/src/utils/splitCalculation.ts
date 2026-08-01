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
