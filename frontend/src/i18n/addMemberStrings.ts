/**
 * Add Member modal strings (EN + FR).
 * The frontend has no i18n layer yet, so the locale is taken from the device.
 */

export interface AddMemberStrings {
  shareViaWhatsApp: string;
  inviteMessage: (groupName: string) => string;
  shareFailedTitle: string;
  shareFailedBody: string;
}

const en: AddMemberStrings = {
  shareViaWhatsApp: 'Share via WhatsApp',
  inviteMessage: (groupName: string): string =>
    `Hey! I've invited you to join "${groupName}" in Expense Manager. It's a great app for splitting expenses with friends and family. Check it out!`,
  shareFailedTitle: 'Could not open WhatsApp',
  shareFailedBody: 'We could not open WhatsApp. Please check that it is installed and try again.',
};

const fr: AddMemberStrings = {
  shareViaWhatsApp: 'Partager via WhatsApp',
  inviteMessage: (groupName: string): string =>
    `Salut ! Je t'ai invité(e) à rejoindre "${groupName}" dans Expense Manager. C'est une excellente application pour partager les dépenses entre amis et en famille. Jette un oeil !`,
  shareFailedTitle: "Impossible d'ouvrir WhatsApp",
  shareFailedBody: "Nous n'avons pas pu ouvrir WhatsApp. Vérifiez qu'il est installé et réessayez.",
};

export function getAddMemberStrings(locale?: string): AddMemberStrings {
  let resolved: string = locale ?? 'en';
  if (!locale) {
    try {
      resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      resolved = 'en';
    }
  }
  return resolved.toLowerCase().startsWith('fr') ? fr : en;
}
