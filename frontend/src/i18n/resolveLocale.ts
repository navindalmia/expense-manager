/**
 * Shared device-locale check for the i18n string modules.
 * The frontend has no i18n layer yet, so an omitted locale is read from the device.
 */
export function isFrenchLocale(locale?: string): boolean {
  let resolved: string = locale ?? 'en';
  if (!locale) {
    try {
      resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      resolved = 'en';
    }
  }
  return resolved.toLowerCase().startsWith('fr');
}
