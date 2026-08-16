import { describe, it, expect } from 'vitest';
import { apiConfig } from '../config';

/**
 * API Config Tests
 *
 * Verifies the axios timeout is long enough to survive a Render free-tier
 * cold start (backend sleeps after ~15min idle, takes 30-50s to wake),
 * while still bounded rather than unlimited.
 */
describe('apiConfig', () => {
  it('should set a timeout long enough to cover a Render cold start (30-50s)', () => {
    expect(apiConfig.timeout).toBeGreaterThanOrEqual(45000);
  });

  it('should keep the timeout bounded rather than unlimited or excessive', () => {
    expect(apiConfig.timeout).toBeLessThanOrEqual(60000);
  });
});
