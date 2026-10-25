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
});
