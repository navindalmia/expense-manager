import { describe, it, expect } from 'vitest';
import { getWhatsNewStrings } from '../../i18n/whatsNewStrings';

describe('getWhatsNewStrings', () => {
  it('should return French for fr locales and English otherwise', () => {
    expect(getWhatsNewStrings('fr-CA').title).toBe('Nouveautés');
    expect(getWhatsNewStrings('en-US').title).toBe("What's new");
  });
  it('should define every key in both languages', () => {
    const en = Object.keys(getWhatsNewStrings('en')).sort();
    expect(Object.keys(getWhatsNewStrings('fr')).sort()).toEqual(en);
  });
});
