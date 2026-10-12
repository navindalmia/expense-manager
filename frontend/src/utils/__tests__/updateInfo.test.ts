import { describe, it, expect, vi, beforeEach } from 'vitest';

const U = vi.hoisted(() => ({ isEmbeddedLaunch: true, updateId: undefined as string | undefined, createdAt: null as Date | null, throwing: false }));
vi.mock('expo-updates', () => ({
  get isEmbeddedLaunch() { if (U.throwing) throw new Error('n/a'); return U.isEmbeddedLaunch; },
  get updateId() { return U.updateId; },
  get createdAt() { return U.createdAt; },
}));

import { getUpdateLabel } from '../updateInfo';

describe('getUpdateLabel', () => {
  beforeEach(() => { Object.assign(U, { isEmbeddedLaunch: true, updateId: undefined, createdAt: null, throwing: false }); });

  it('should say embedded build for the bundled JS', () => {
    expect(getUpdateLabel()).toBe('embedded build');
  });
  it('should show short id and local date for an OTA update', () => {
    Object.assign(U, { isEmbeddedLaunch: false, updateId: 'a1b2c3d4-e5f6', createdAt: new Date(2026, 9, 12, 19, 4) });
    expect(getUpdateLabel()).toBe('upd a1b2c3d 12 Oct 19:04');
  });
  it('should omit the date when createdAt is missing', () => {
    Object.assign(U, { isEmbeddedLaunch: false, updateId: 'a1b2c3d4' });
    expect(getUpdateLabel()).toBe('upd a1b2c3d');
  });
  it('should return empty string when expo-updates throws', () => {
    U.throwing = true;
    expect(getUpdateLabel()).toBe('');
  });
});
