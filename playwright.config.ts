import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for real E2E tests against Expo web + a live backend.
 *
 * Deliberately does NOT start webServer processes itself -- backend and
 * Expo web must already be running (docker-compose postgres, `npm run
 * backend:dev`, `npx expo start --web`) since these tests hit real,
 * stateful services (a real Postgres DB via the backend), not something
 * safe to spin up/tear down automatically per run.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'retain-on-failure',
    // Note: unlike the Vitest jsdom component tests (whose hand-rolled RN
    // mock forwards `testID` as a nonstandard lowercase `testid` DOM
    // attribute), the real react-native-web runtime used here correctly
    // maps `testID` to the standard `data-testid` -- so Playwright's
    // default getByTestId (no testIdAttribute override needed) just works.
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
