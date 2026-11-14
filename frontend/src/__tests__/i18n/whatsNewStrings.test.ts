import { describe, it, expect, vi } from 'vitest';
import { getWhatsNewStrings } from '../../i18n/whatsNewStrings';
import { getAddMemberStrings } from '../../i18n/addMemberStrings';
import { isFrenchLocale } from '../../i18n/resolveLocale';

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

describe('isFrenchLocale', () => {
  it('should match fr locales case-insensitively and reject others', () => {
    expect(isFrenchLocale('fr-CA')).toBe(true);
    expect(isFrenchLocale('FR')).toBe(true);
    expect(isFrenchLocale('en-US')).toBe(false);
  });
  it('should fall back to the device locale when none is given', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({ locale: 'fr-FR' }) }) as Intl.DateTimeFormat);
    expect(isFrenchLocale()).toBe(true);
    expect(getWhatsNewStrings().title).toBe('Nouveautés');
    spy.mockImplementation(() => { throw new Error('no intl'); });
    expect(isFrenchLocale()).toBe(false);
    spy.mockRestore();
  });
  it('should drive both string modules', () => {
    expect(getAddMemberStrings('fr').shareViaWhatsApp).toBe('Partager via WhatsApp');
    expect(getAddMemberStrings('en').shareViaWhatsApp).toBe('Share via WhatsApp');
  });
});
