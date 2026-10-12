import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { buildConfig } = require('../../../app.config.js') as {
  buildConfig: (env: Record<string, string | undefined>, now?: number) => { expo: Record<string, any> };
};

const productionFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'app.production.fixture.json'), 'utf8'),
) as { expo: Record<string, unknown> };

describe('app.config.js', () => {
  it('should resolve to the former app.json when APP_VARIANT is unset', () => {
    expect(buildConfig({})).toEqual(productionFixture);
  });

  it('should resolve to the former app.json when APP_VARIANT is production', () => {
    expect(buildConfig({ APP_VARIANT: 'production' })).toEqual(productionFixture);
  });

  it('should use a separate package, scheme and name for the staging variant', () => {
    const { expo } = buildConfig({ APP_VARIANT: 'staging' });
    expect(expo.android.package).toBe('com.navindalmia.expensemanager.staging');
    expect(expo.scheme).toBe('expensemanagerstaging');
    expect(expo.name).toBe('Expense Manager (Staging)');
  });

  it('should keep the shared EAS project, slug and owner in the staging variant', () => {
    const { expo } = buildConfig({ APP_VARIANT: 'staging' });
    expect(expo.slug).toBe('expense-manager');
    expect(expo.owner).toBe('navindalmia');
    expect(expo.extra.eas.projectId).toBe(productionFixture.expo.extra && (productionFixture.expo.extra as any).eas.projectId);
  });

  it('should leave production android package untouched', () => {
    expect(buildConfig({}).expo.android.package).toBe('com.navindalmia.expensemanager');
  });
});

describe('staging versionCode', () => {
  it('should increase with time so successive staging APKs install over each other', () => {
    const a = buildConfig({ APP_VARIANT: 'staging' }, 60000 * 1000).expo.android.versionCode;
    const b = buildConfig({ APP_VARIANT: 'staging' }, 60000 * 1001).expo.android.versionCode;
    expect(b).toBeGreaterThan(a);
  });

  it('should honour STAGING_VERSION_CODE and never set versionCode in production', () => {
    expect(buildConfig({ APP_VARIANT: 'staging', STAGING_VERSION_CODE: '42' }).expo.android.versionCode).toBe(42);
    expect(buildConfig({}).expo.android.versionCode).toBeUndefined();
  });
});

describe('eas.json profiles', () => {
  const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../eas.json'), 'utf8'));
  const PROD_URL = 'https://expense-manager-udoo.onrender.com/api';

  it('should never point the staging profile at the production API', () => {
    const url = eas.build.staging.env.EXPO_PUBLIC_API_BASE_URL as string;
    expect(url).not.toBe(PROD_URL);
    expect(url).not.toContain('expense-manager-udoo');
  });

  it('should build the staging profile as an APK on the staging channel with APP_VARIANT=staging', () => {
    expect(eas.build.staging.channel).toBe('staging');
    expect(eas.build.staging.android.buildType).toBe('apk');
    expect(eas.build.staging.env.APP_VARIANT).toBe('staging');
  });

  it('should leave the preview profile pointing at production', () => {
    expect(eas.build.preview.env.EXPO_PUBLIC_API_BASE_URL).toBe(PROD_URL);
    expect(eas.build.preview.channel).toBe('preview');
    expect(eas.build.preview.env.APP_VARIANT).toBeUndefined();
  });

  describe('staging icons', () => {
    const assets = path.join(__dirname, '..', '..', '..', 'assets');
    const png = (f: string): Buffer => fs.readFileSync(path.join(assets, f));

    it('should point the staging variant at the staging icon files', () => {
      const { expo } = buildConfig({ APP_VARIANT: 'staging' });
      expect(expo.icon).toBe('./assets/icon-staging.png');
      expect(expo.web.favicon).toBe('./assets/favicon-staging.png');
      expect(expo.android.adaptiveIcon.foregroundImage).toBe('./assets/adaptive-icon-staging.png');
      expect(expo.android.adaptiveIcon.backgroundColor).toBe('#F57C00');
    });

    it('should keep the production icons unchanged', () => {
      const { expo } = buildConfig({});
      expect(expo.icon).toBe('./assets/icon.png');
      expect(expo.android.adaptiveIcon.backgroundColor).toBe('#ffffff');
    });

    it.each([
      ['icon-staging.png', 1024],
      ['adaptive-icon-staging.png', 1024],
      ['favicon-staging.png', 48],
    ])('should ship %s as a %i px PNG', (file, size) => {
      const b = png(file);
      expect(b.subarray(1, 4).toString()).toBe('PNG');
      expect(b.readUInt32BE(16)).toBe(size);
      expect(b.readUInt32BE(20)).toBe(size);
    });
  });
});
