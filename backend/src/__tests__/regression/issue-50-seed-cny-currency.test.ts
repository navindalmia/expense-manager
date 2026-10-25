import { SEED_CURRENCIES } from '../../lib/seedCurrencies';
import { ALLOWED_GROUP_CURRENCY_CODES } from '../../schemas/groupSchema';

describe('SEED_CURRENCIES', () => {
  it('should allow exactly the seeded currency codes plus OTHER in the group schema', () => {
    const seededCodes: string[] = SEED_CURRENCIES.map((c) => c.code);
    expect([...ALLOWED_GROUP_CURRENCY_CODES].sort()).toEqual([...seededCodes, 'OTHER'].sort());
  });

  it('should keep the anchor set of 13 currencies in the seed so truncating it fails', () => {
    const seededCodes: string[] = SEED_CURRENCIES.map((c) => c.code);
    const anchor: string[] = ['GBP', 'USD', 'EUR', 'INR', 'AUD', 'CAD', 'JPY', 'CNY', 'SGD', 'HKD', 'CHF', 'NZD', 'SEK'];
    for (const code of anchor) {
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
