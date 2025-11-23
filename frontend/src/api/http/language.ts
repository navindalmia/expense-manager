
/**
 * Responsibility:
 *  - Maintain the current language preference on the frontend.
 *  - Expose getter/setter so any module (like Axios interceptors) can use it.
 *  - Default to navigator language or fallback to 'en'.

 */

const DEFAULT_LANGUAGE = "en";

let currentLanguage: string = DEFAULT_LANGUAGE;

/**
 * Sets the current language for API requests.
 * Typically called once after user preference is loaded or app starts.
 */
export function setLanguage(lang: string) {
  if (!lang) return;
  currentLanguage = lang;
}

/**
 * Gets the current language for API requests.
 */
export function getLanguage(): string {
  return currentLanguage;
}

/**
 * Optionally, auto-detect from device on first load.
 */
export function initLanguageFromDevice() {
  if (typeof navigator !== "undefined" && navigator.language) {
    currentLanguage = navigator.language.split("-")[0] || DEFAULT_LANGUAGE;
  }
  // else keep default
}
