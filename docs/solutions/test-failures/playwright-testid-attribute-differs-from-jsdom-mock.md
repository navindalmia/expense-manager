---
title: Playwright's real testID->data-testid mapping differs from the Vitest jsdom mock's nonstandard lowercase testid
date: 2026-09-14
category: test-failures
module: e2e (Playwright), frontend/src/tests/setup.tsx
problem_type: test_failure
component: testing_framework
symptoms:
  - "page.getByTestId('email-input') times out (Playwright, real browser, real react-native-web) even though the element visibly renders"
  - "A raw CSS attribute selector like page.locator('[testid=\"foo\"]') also finds nothing in a real Playwright run"
  - "The exact same testID lookup pattern (querying a lowercase testid attribute) works fine in Vitest component tests but fails in Playwright E2E"
root_cause: config_error
resolution_type: config_change
severity: medium
tags: [playwright, testid, data-testid, react-native-web, vitest, jsdom-mock]
---

# Playwright's real testID->data-testid mapping differs from the Vitest jsdom mock's nonstandard lowercase testid

## Problem

Writing the first real Playwright E2E spec against this app's Expo web build, `page.getByTestId(...)` (and a manual `[testid="..."]` CSS selector) found nothing, even though the target element was visibly on screen and had a `testID` prop set in the React Native source.

## Symptoms

- `Error: locator.fill: Test timeout of 30000ms exceeded. ... waiting for getByTestId('email-input')`
- Manually configuring Playwright's `testIdAttribute: 'testid'` (lowercase) — copying the pattern already used throughout this repo's Vitest component tests — made it *worse*, not better: still zero matches.
- Dumping `page.content()` after a wait showed the real rendered DOM had `data-testid="email-input"` on the `<input>` — standard, correctly-cased — not `testid="email-input"`.

## What Didn't Work

- Assuming the Vitest component-test convention ("RN's testID renders as a lowercase `testid` attribute, not `data-testid`" — a real, correct fact documented in several `__tests__/*.test.tsx` files in this repo) also applied to a real Playwright run. It doesn't. Setting `testIdAttribute: 'testid'` in `playwright.config.ts` actively broke `getByTestId` for the real DOM, which already had standard `data-testid`.

## Solution

Remove the `testIdAttribute` override entirely from `playwright.config.ts`. Playwright's default (`data-testid`) is correct for a real react-native-web build. Use `page.getByTestId(...)` normally, and if a raw CSS attribute selector is ever needed (e.g. `page.locator('[data-testid^="prefix-"]')` for a dynamic-id prefix match), use `data-testid`, not `testid`.

```ts
// playwright.config.ts — no testIdAttribute override needed
export default defineConfig({
  use: {
    baseURL: 'http://localhost:8081',
    // real react-native-web maps testID -> data-testid correctly by default
  },
});
```

## Why This Works

The two test environments render RN primitives completely differently:

- **Vitest component tests** (`frontend/src/tests/setup.tsx`) use a hand-rolled mock: `TouchableOpacity: ({ children, onPress, disabled, ...props }) => <button {...props} ...>`. This mock spreads the raw `testID` prop directly onto a plain DOM element with no special-casing, so React renders it as a literal lowercase `testid` attribute (an unrecognized custom prop passed through verbatim) — not the `data-testid` `@testing-library/react`'s `getByTestId` expects by default. This is why those test files have their own local `getByTestId` helper querying `[testid="..."]` directly.
- **A real Playwright run against `npx expo start --web`** uses the actual `react-native-web` library, not a mock. Its real primitives (`View`, `TouchableOpacity`, `TextInput`, etc.) correctly map the `testID` prop to the standard `data-testid` DOM attribute, matching web conventions and Playwright's own default `getByTestId` behavior.

The two conventions look almost identical (`testid` vs `data-testid` — one character) but come from two unrelated causes: one is a real library's correct, standards-compliant behavior; the other is an incomplete test mock's side effect. The Vitest lesson does not transfer to Playwright, and assuming it does actively breaks Playwright's own correct default.

## Prevention

- When writing a **new Playwright E2E spec** in this repo, do not port the `[testid="..."]` pattern from Vitest component tests — use plain `page.getByTestId(...)` (standard `data-testid`, no config override).
- When writing a **new Vitest component test**, the existing local `getByTestId`/`queryByTestId` helper pattern (querying `[testid="..."]` on `result.container`) remains correct — that mock's behavior hasn't changed.
- If a future Playwright test genuinely fails to find an element by testid, dump `await page.content()` (or use `page.pause()`/inspector) and check the real attribute name and casing on the actual rendered DOM before assuming it's the same gotcha as the Vitest mock — don't guess from memory.

## Related Issues

- `frontend/src/screens/__tests__/CreateExpenseScreen.test.tsx` and similar files document the Vitest-side convention this doc distinguishes from.
- `e2e/intelligence-layer.spec.ts` — the spec that surfaced this, first real Playwright E2E coverage in the repo.
