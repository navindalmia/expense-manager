import { SEED_CURRENCIES } from '../seedCurrencies';
import { createGroupSchema } from '../../schemas/groupSchema';

describe('SEED_CURRENCIES', () => {
  it('should include every currency code the group schema accepts (except OTHER) so saving a group never hits GROUP.CURRENCY_NOT_FOUND', () => {
    const seededCodes: string[] = SEED_CURRENCIES.map((c) => c.code);
    const schemaCodes: string[] = createGroupSchema.shape.currency
      .removeDefault()
      .unwrap()
      .options.filter((c: string) => c !== 'OTHER');
    for (const code of schemaCodes) {
      expect(seededCodes).toContain(code);
    }
  });

  it('should include CNY (regression for issue #50)', () => {
    expect(SEED_CURRENCIES.map((c) => c.code)).toContain('CNY');
  });

  it('should not contain duplicate codes', () => {
    const codes = SEED_CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
