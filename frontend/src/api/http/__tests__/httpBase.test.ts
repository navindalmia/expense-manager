import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';

/**
 * httpBase Tests
 *
 * `axios` is globally mocked in src/tests/setup.tsx (axios.create returns a
 * plain object with no real `.defaults`), so we assert on the config object
 * httpBase.ts actually passes into axios.create rather than on a real
 * axios instance's `.defaults`.
 *
 * httpBase.ts reads EXPO_PUBLIC_API_BASE_URL at import time, so each scenario
 * needs an isolated module registry (vi.resetModules) with the env var set
 * before the dynamic import — setting it after import has no effect.
 */
describe('httpBase', () => {
  const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_BASE_URL;
  const mockCreate = vi.mocked(axios.create);

  beforeEach(() => {
    vi.resetModules();
    mockCreate.mockClear();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
  });

  async function importAndGetConfig() {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4000/api';
    await import('../httpBase');
    return mockCreate.mock.calls[0][0];
  }

  it('should set a timeout long enough to cover a Render cold start (30-50s)', async () => {
    const config = await importAndGetConfig();

    expect(config?.timeout).toBeGreaterThanOrEqual(45000);
  });

  it('should keep the timeout bounded rather than unlimited or excessive', async () => {
    const config = await importAndGetConfig();

    expect(config?.timeout).toBeLessThanOrEqual(60000);
  });

  it('should strip a trailing slash from the configured base URL', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/';
    await import('../httpBase');
    const config = mockCreate.mock.calls[0][0];

    expect(config?.baseURL).toBe('http://localhost:4000/api');
  });

  it('should throw when EXPO_PUBLIC_API_BASE_URL is not set', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = '';

    await expect(import('../httpBase')).rejects.toThrow(
      /EXPO_PUBLIC_API_BASE_URL is not defined/
    );
  });
});
