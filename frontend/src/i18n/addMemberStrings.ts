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
  shareViaWhatsApp: 'Share invite via WhatsApp',
  inviteMessage: (groupName: string): string =>
    `Hey! I've invited you to join "${groupName}" in Expense Manager. It's a great app for splitting expenses with friends and family. Check it out!`,
  shareFailedTitle: 'Could not share the invite',
  shareFailedBody: 'The member was added. You can share the invite later from the group.',
};

const fr: AddMemberStrings = {
  shareViaWhatsApp: "Partager l'invitation via WhatsApp",
  inviteMessage: (groupName: string): string =>
    `Salut ! Je t'ai invité(e) à rejoindre "${groupName}" dans Expense Manager. C'est une excellente application pour partager les dépenses entre amis et en famille. Jette un oeil !`,
  shareFailedTitle: "Impossible de partager l'invitation",
  shareFailedBody: "Le membre a été ajouté. Vous pourrez partager l'invitation plus tard depuis le groupe.",
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
