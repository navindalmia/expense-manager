import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../app.json'), 'utf8')) as {
  expo: { runtimeVersion: unknown; updates: Record<string, unknown> };
};

describe('production OTA launch wait', () => {
  it('should check for updates on load and wait up to 5s for them', () => {
    expect(appJson.expo.updates.checkAutomatically).toBe('ON_LOAD');
    expect(appJson.expo.updates.fallbackToCacheTimeout).toBe(5000);
  });

  it('should keep runtimeVersion policy appVersion so existing installs still match', () => {
    expect(appJson.expo.runtimeVersion).toEqual({ policy: 'appVersion' });
  });
});
