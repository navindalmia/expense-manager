import { SEED_CURRENCIES } from '../../lib/seedCurrencies';
import { createGroupSchema } from '../../schemas/groupSchema';

describe('issue #141: create group accepts every seeded currency', () => {
  it.each(SEED_CURRENCIES.map((c) => c.code))(
    'should accept %s as a group currency',
    (code: string) => {
      const result = createGroupSchema.safeParse({ name: 'Trip', currency: code });
      expect(result.success).toBe(true);
    },
  );

  it('should reject a currency code that is not seeded', () => {
    expect(createGroupSchema.safeParse({ name: 'Trip', currency: 'XXX' }).success).toBe(false);
  });

  it('should default an omitted currency to GBP', () => {
    const result = createGroupSchema.safeParse({ name: 'Trip' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.currency).toBe('GBP');
  });

  it('should still accept OTHER as a currency', () => {
    expect(createGroupSchema.safeParse({ name: 'Trip', currency: 'OTHER' }).success).toBe(true);
  });

  it('should reject a lowercase currency code', () => {
    expect(createGroupSchema.safeParse({ name: 'Trip', currency: 'gbp' }).success).toBe(false);
  });

  it('should reject an empty currency string', () => {
    expect(createGroupSchema.safeParse({ name: 'Trip', currency: '' }).success).toBe(false);
  });
});
