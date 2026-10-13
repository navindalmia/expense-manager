/**
 * About / build info helper.
 *
 * Collects non-secret facts about the running build (version, environment,
 * JS update id, backend host) for the About screen. Every native-module read is
 * wrapped in try/catch so jest/vitest and web never crash.
 */
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { isStaging } from './appVariant';

export type AppEnvironment = 'production' | 'staging';

export interface AboutInfo {
  appName: string;
  version: string;
  buildNumber: string | null;
  environment: AppEnvironment;
  updateId: string | null;
  updateCreatedAt: string | null;
  isEmbedded: boolean;
  backendHost: string;
}

function resolveEnvironment(): AppEnvironment {
  try {
    return isStaging() ? 'staging' : 'production';
  } catch {
    return 'production';
  }
}

function resolveBuildNumber(): string | null {
  try {
    const native = Constants.nativeBuildVersion;
    if (native) return String(native);
    const code = Constants.expoConfig?.android?.versionCode;
    return code ? String(code) : null;
  } catch {
    return null;
  }
}

/** Hostname only - never the path, query, credentials or port-less secrets. */
export function extractHost(rawUrl: string | undefined): string {
  const value = (rawUrl ?? '').trim();
  if (!value) return 'unknown';
  try {
    return new URL(value).hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

function resolveUpdate(): Pick<AboutInfo, 'updateId' | 'updateCreatedAt' | 'isEmbedded'> {
  try {
    const embedded = Updates.isEmbeddedLaunch !== false;
    const id = Updates.updateId ? String(Updates.updateId).slice(0, 7) : null;
    const created = Updates.createdAt ? new Date(Updates.createdAt).toISOString().slice(0, 10) : null;
    if (embedded || !id) return { updateId: null, updateCreatedAt: null, isEmbedded: true };
    return { updateId: id, updateCreatedAt: created, isEmbedded: false };
  } catch {
    return { updateId: null, updateCreatedAt: null, isEmbedded: true };
  }
}

export function getAboutInfo(): AboutInfo {
  return {
    appName: Constants.expoConfig?.name ?? 'Expense Manager',
    version: Constants.expoConfig?.version ?? 'unknown',
    buildNumber: resolveBuildNumber(),
    environment: resolveEnvironment(),
    ...resolveUpdate(),
    backendHost: extractHost(process.env.EXPO_PUBLIC_API_BASE_URL),
  };
}
