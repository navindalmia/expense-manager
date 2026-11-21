/** Issue #155: /api/internal/* must be mounted only with an explicit opt-in outside production. */
import { areInternalRoutesEnabled } from '../../config/env';

describe('issue #155: internal routes are opt-in', () => {
  it('should not be enabled in a plain development environment', () => {
    expect(areInternalRoutesEnabled({ NODE_ENV: 'development' })).toBe(false);
  });

  it('should not be enabled when NODE_ENV is unset', () => {
    expect(areInternalRoutesEnabled({})).toBe(false);
  });

  it('should require the exact value "true"', () => {
    expect(areInternalRoutesEnabled({ NODE_ENV: 'development', ENABLE_INTERNAL_ROUTES: '1' })).toBe(false);
  });

  it('should never be enabled in production', () => {
    expect(areInternalRoutesEnabled({ NODE_ENV: 'production', ENABLE_INTERNAL_ROUTES: 'true' })).toBe(false);
  });
});
