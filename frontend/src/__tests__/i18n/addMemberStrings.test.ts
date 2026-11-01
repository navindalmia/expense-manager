import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAddMemberStrings } from '../../i18n/addMemberStrings';

describe('getAddMemberStrings', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('should return French for fr-FR', () => {
    expect(getAddMemberStrings('fr-FR').shareViaWhatsApp).toBe('Partager via WhatsApp');
  });

  it('should return English for en-US', () => {
    expect(getAddMemberStrings('en-US').shareViaWhatsApp).toBe('Share via WhatsApp');
  });

  it('should fall back to the device locale when undefined', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () => ({ resolvedOptions: () => ({ locale: 'en-GB' }) }) as unknown as Intl.DateTimeFormat,
    );
    expect(getAddMemberStrings(undefined).shareViaWhatsApp).toBe('Share via WhatsApp');
  });

  it('should return English when Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => { throw new Error('no intl'); });
    expect(getAddMemberStrings().shareViaWhatsApp).toBe('Share via WhatsApp');
  });
});
