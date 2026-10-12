import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConstants = vi.hoisted(() => ({ expoConfig: undefined as unknown }));
vi.mock('expo-constants', () => ({ default: mockConstants }));

import { isStaging } from '../appVariant';

describe('isStaging', () => {
  beforeEach(() => { mockConstants.expoConfig = undefined; });

  it('should be false when expoConfig is undefined', () => {
    expect(isStaging()).toBe(false);
  });
  it('should be false when appVariant is missing or production', () => {
    mockConstants.expoConfig = { extra: {} };
    expect(isStaging()).toBe(false);
    mockConstants.expoConfig = { extra: { appVariant: 'production' } };
    expect(isStaging()).toBe(false);
  });
  it('should be true when appVariant is staging', () => {
    mockConstants.expoConfig = { extra: { appVariant: 'staging' } };
    expect(isStaging()).toBe(true);
  });
});
