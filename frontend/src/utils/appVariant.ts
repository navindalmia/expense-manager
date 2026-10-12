import Constants from 'expo-constants';

/**
 * True only in the staging build (app.config.js sets extra.appVariant when
 * APP_VARIANT=staging). Anything else, including a missing key, is production.
 */
export function isStaging(): boolean {
  const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
  return extra?.appVariant === 'staging';
}
