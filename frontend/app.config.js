// Dynamic Expo config. Replaces the static app.json (same content, same keys).
//
// APP_VARIANT selects the build flavour:
//   (unset / "production") -> identical to the former app.json
//   "staging"              -> separate Android app id, scheme and name so the
//                             staging app installs beside the live one and
//                             deep links never open the wrong app.
// The EAS projectId, slug and owner stay shared: staging is a second
// application id inside the same Expo project.
//
// IMPORTANT: the production output is pinned by a fixture
// (src/__tests__/config/app.production.fixture.json). If you intentionally
// change the production config below, update that fixture in the same commit.
//
// Staging versionCode: eas.json `autoIncrement` cannot write to a dynamic
// config with appVersionSource "local", so the staging variant derives a
// monotonically increasing versionCode (minutes since epoch, or the
// STAGING_VERSION_CODE env override) so each staging APK installs over the last.
'use strict';

const baseConfig = {
  "name": "expense-manager",
  "slug": "expense-manager",
  "version": "1.0.0",
  "orientation": "portrait",
  "icon": "./assets/icon.png",
  "userInterfaceStyle": "light",
  "newArchEnabled": true,
  "splash": {
    "image": "./assets/splash-icon.png",
    "resizeMode": "contain",
    "backgroundColor": "#ffffff"
  },
  "ios": {
    "bundleIdentifier": "com.navindalmia.expensemanager",
    "supportsTablet": true
  },
  "android": {
    "package": "com.navindalmia.expensemanager",
    "adaptiveIcon": {
      "foregroundImage": "./assets/adaptive-icon.png",
      "backgroundColor": "#ffffff"
    },
    "edgeToEdgeEnabled": true,
    "predictiveBackGestureEnabled": false
  },
  "web": {
    "favicon": "./assets/favicon.png"
  },
  "extra": {
    "eas": {
      "projectId": "63b2fcf6-3023-4438-ae0c-1cae0a79d675"
    }
  },
  "owner": "navindalmia",
  "runtimeVersion": {
    "policy": "appVersion"
  },
  "updates": {
    "url": "https://u.expo.dev/63b2fcf6-3023-4438-ae0c-1cae0a79d675"
  }
};

const STAGING_OVERRIDES = {
  name: 'Expense Manager (Staging)',
  scheme: 'expensemanagerstaging',
  androidPackage: 'com.navindalmia.expensemanager.staging',
};

function stagingVersionCode(env, now) {
  const override = Number(env.STAGING_VERSION_CODE);
  return Number.isInteger(override) && override > 0 ? override : Math.floor(now / 60000);
}

function buildConfig(env = process.env, now = Date.now()) {
  if (env.APP_VARIANT !== 'staging') {
    return { expo: baseConfig };
  }
  return {
    expo: {
      ...baseConfig,
      name: STAGING_OVERRIDES.name,
      scheme: STAGING_OVERRIDES.scheme,
      android: {
        ...baseConfig.android,
        package: STAGING_OVERRIDES.androidPackage,
        versionCode: stagingVersionCode(env, now),
      },
    },
  };
}

// Expo calls the exported function with { config }; we ignore it and return the full config.
module.exports = () => buildConfig(process.env);
module.exports.buildConfig = buildConfig;
