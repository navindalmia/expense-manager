import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockConstants, mockUpdates } = vi.hoisted(() => ({
  mockConstants: { expoConfig: null, nativeBuildVersion: null } as {
    expoConfig: Record<string, unknown> | null;
    nativeBuildVersion: string | null;
  },
  mockUpdates: {} as Record<string, unknown>,
}));

vi.mock('expo-constants', () => ({ default: mockConstants }));
vi.mock('expo-updates', () => mockUpdates);

import { getAboutInfo, extractHost } from '../aboutInfo';

describe('aboutInfo', () => {
  beforeEach(() => {
    mockConstants.expoConfig = { name: 'expense-manager', version: '1.0.0' };
    mockConstants.nativeBuildVersion = null;
    for (const k of Object.keys(mockUpdates)) delete mockUpdates[k];
    mockUpdates.isEmbeddedLaunch = true;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com:8443/api?token=secret';
  });

  it('should report production and embedded build for the default config', () => {
    const info = getAboutInfo();
    expect(info.environment).toBe('production');
    expect(info.version).toBe('1.0.0');
    expect(info.isEmbedded).toBe(true);
    expect(info.updateId).toBeNull();
    expect(info.buildNumber).toBeNull();
  });

  it('should report staging when extra.appVariant is staging', () => {
    mockConstants.expoConfig = { version: '1.0.0', extra: { appVariant: 'staging' }, android: { versionCode: 29123456 } };
    const info = getAboutInfo();
    expect(info.environment).toBe('staging');
    expect(info.buildNumber).toBe('29123456');
  });

  it('should prefer extra.appVariant when present', () => {
    mockConstants.expoConfig = { version: '1.0.0', extra: { appVariant: 'staging' } };
    expect(getAboutInfo().environment).toBe('staging');
  });

  it('should show a short update id and date for an OTA launch', () => {
    mockUpdates.isEmbeddedLaunch = false;
    mockUpdates.updateId = 'abcdef1234567890';
    mockUpdates.createdAt = new Date('2026-10-01T10:00:00Z');
    const info = getAboutInfo();
    expect(info.isEmbedded).toBe(false);
    expect(info.updateId).toBe('abcdef1');
    expect(info.updateCreatedAt).toBe('2026-10-01');
  });

  it('should prefer the native build version over versionCode', () => {
    mockConstants.nativeBuildVersion = '42';
    expect(getAboutInfo().buildNumber).toBe('42');
  });

  it('should expose the hostname only, never path, port or query', () => {
    expect(getAboutInfo().backendHost).toBe('api.example.com');
  });

  it('should return unknown for a missing or invalid API URL', () => {
    expect(extractHost(undefined)).toBe('unknown');
    expect(extractHost('not a url')).toBe('unknown');
  });

  it('should not throw when expo-updates throws', () => {
    Object.defineProperty(mockUpdates, 'isEmbeddedLaunch', { get() { throw new Error('native'); }, configurable: true });
    expect(getAboutInfo().isEmbedded).toBe(true);
  });
});
