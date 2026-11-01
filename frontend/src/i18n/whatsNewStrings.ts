/**
 * "What's new" screen strings (EN + FR).
 * The frontend has no i18n layer yet, so the locale is taken from the device.
 */
import { isFrenchLocale } from './resolveLocale';

export interface WhatsNewStrings {
  title: string;
  latest: string;
  olderReleases: string;
  seeAll: string;
  hideOlder: string;
  loading: string;
  empty: string;
  noBullets: string;
  retry: string;
  showingSaved: string;
  errorOffline: string;
  errorRateLimit: string;
  errorNotFound: string;
  errorBadResponse: string;
  errorGeneric: string;
}

const en: WhatsNewStrings = {
  title: "What's new",
  latest: 'Latest release',
  olderReleases: 'Older releases',
  seeAll: 'See all',
  hideOlder: 'Hide older releases',
  loading: 'Loading release notes...',
  empty: 'No release notes have been published yet.',
  noBullets: 'No details were listed for this release.',
  retry: 'Retry',
  showingSaved: 'Showing the last saved notes.',
  errorOffline: 'You appear to be offline. Check your connection and retry.',
  errorRateLimit: 'GitHub is limiting requests right now. Please try again in a while.',
  errorNotFound: 'Release notes were not found.',
  errorBadResponse: 'GitHub returned an unexpected response. Please retry.',
  errorGeneric: 'Could not load the release notes. Please retry.',
};

const fr: WhatsNewStrings = {
  title: 'Nouveautés',
  latest: 'Dernière version',
  olderReleases: 'Versions précédentes',
  seeAll: 'Tout voir',
  hideOlder: 'Masquer les versions précédentes',
  loading: 'Chargement des notes de version...',
  empty: "Aucune note de version n'a encore été publiée.",
  noBullets: "Aucun détail n'a été indiqué pour cette version.",
  retry: 'Réessayer',
  showingSaved: 'Affichage des dernières notes enregistrées.',
  errorOffline: 'Vous semblez hors ligne. Vérifiez votre connexion et réessayez.',
  errorRateLimit: 'GitHub limite les requêtes pour le moment. Réessayez dans un moment.',
  errorNotFound: 'Les notes de version sont introuvables.',
  errorBadResponse: 'GitHub a renvoyé une réponse inattendue. Veuillez réessayer.',
  errorGeneric: 'Impossible de charger les notes de version. Veuillez réessayer.',
};

export function getWhatsNewStrings(locale?: string): WhatsNewStrings {
  return isFrenchLocale(locale) ? fr : en;
}
