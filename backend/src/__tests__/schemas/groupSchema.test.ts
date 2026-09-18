/**
 * Group Schema Tests
 *
 * Regression coverage for issue #50: createGroupSchema's `currency` field
 * hardcoded a Zod enum (['GBP','INR','USD','EUR','AUD','CAD','JPY','CNY',
 * 'OTHER']) that had drifted from the actual Currency table -- it allowed
 * 'CNY' and 'OTHER', neither of which exist in the seeded Currency table,
 * and rejected several real currencies (SGD, HKD, CHF, NZD, SEK) outright
 * at the validation layer, before groupService.createGroup's own
 * DB-backed currency lookup ever ran. This made POST /groups behave
 * differently from PATCH /groups/:id (updateGroup has no such Zod
 * restriction and only ever defers to the DB), which is also issue #51's
 * root cause.
 */

import { validateGroupInput } from '../../schemas/groupSchema';

describe('createGroupSchema', () => {
  it('should accept a currency code the old hardcoded enum did not allow (SEK)', () => {
    const result = validateGroupInput({ name: 'Trip', currency: 'SEK' });
    expect(result.currency).toBe('SEK');
  });

  it('should accept every currency the old hardcoded enum was missing', () => {
    for (const code of ['SGD', 'HKD', 'CHF', 'NZD', 'SEK']) {
      const result = validateGroupInput({ name: 'Trip', currency: code });
      expect(result.currency).toBe(code);
    }
  });

  it('should no longer special-case CNY as a schema-level valid value (it is not a real seeded currency; DB lookup in the service is now the single source of truth)', () => {
    // CNY is 3 letters, so it's schema-shape-valid like any real code would
    // be -- rejecting it is groupService.createGroup's job
    // (CURRENCY_NOT_FOUND via the DB lookup), not the schema's. This test
    // only guards against the schema re-introducing its own separate
    // hardcoded currency allow-list.
    expect(() => validateGroupInput({ name: 'Trip', currency: 'CNY' })).not.toThrow();
  });

  it('should reject a currency value that is not shaped like a 3-letter code (e.g. the old enum\'s "OTHER")', () => {
    expect(() => validateGroupInput({ name: 'Trip', currency: 'OTHER' })).toThrow();
  });

  it('should default to GBP when currency is omitted', () => {
    const result = validateGroupInput({ name: 'Trip' });
    expect(result.currency).toBe('GBP');
  });

  it('should reject a name that is empty', () => {
    expect(() => validateGroupInput({ name: '' })).toThrow();
  });
});
