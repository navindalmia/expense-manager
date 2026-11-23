/** EN/FR strings for the "Check for update" control (device locale, English fallback). */
export type UpdateStringKey = 'button' | 'working' | 'disabled' | 'checking' | 'latest' | 'downloading' | 'restarting' | 'failed';

const STRINGS: Record<'en' | 'fr', Record<UpdateStringKey, string>> = {
  en: {
    button: 'Check for update',
    working: 'Working...',
    disabled: 'Updates are not enabled in this build.',
    checking: 'Checking for an update...',
    latest: 'You already have the latest update.',
    downloading: 'Downloading the update...',
    restarting: 'Restarting to apply the update...',
    failed: 'Update check failed',
  },
  fr: {
    button: 'Rechercher une mise à jour',
    working: 'En cours...',
    disabled: "Les mises à jour ne sont pas activées dans cette version.",
    checking: 'Recherche de mise à jour...',
    latest: 'Vous avez déjà la dernière mise à jour.',
    downloading: 'Téléchargement de la mise à jour...',
    restarting: 'Redémarrage pour appliquer la mise à jour...',
    failed: 'Échec de la recherche de mise à jour',
  },
};

export function getLocale(): 'en' | 'fr' {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export function updateText(key: UpdateStringKey, locale: 'en' | 'fr' = getLocale()): string {
  return STRINGS[locale][key];
}
