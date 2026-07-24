---
title: setupFilesAfterEnv Prisma mock factory silently wins over per-file jest.mock()
date: 2026-07-24
category: test-failures
module: backend/src/__tests__/setup.ts
problem_type: test_failure
component: testing_framework
symptoms:
  - "prisma.currency is undefined in a test file that calls jest.mock('../../lib/prisma') with no factory"
  - "prisma.expense.updateMany is not a function, despite jest.mock('../../lib/prisma') being called in the failing test file"
  - "Object.keys(prisma) inside a test lists only a handful of Prisma models (expense, user, group, category, emailVerificationToken), never the full generated client shape"
root_cause: config_error
resolution_type: test_fix
severity: medium
tags: [jest, prisma, mocking, setupFilesAfterEnv, test-isolation]
---

# setupFilesAfterEnv Prisma mock factory silently wins over per-file jest.mock()

## Problem

`backend/src/__tests__/setup.ts` registers `jest.mock('../lib/prisma', () => ({ ... }))` with an explicit factory via Jest's `setupFilesAfterEnv`. Several test files *also* call `jest.mock('../../lib/prisma')` with no factory (expecting Jest's automock to fill in every Prisma delegate). The assumption was that the per-file bare `jest.mock()` would override or supplement the setup file's mock. It does neither — the setup file's factory silently wins, and any Prisma model or method it omits is simply `undefined` in every test file, with no error until a test actually calls it.

## Symptoms

- `TypeError: Cannot read properties of undefined (reading 'findUnique')` on `prisma.currency.findUnique` in a test file that never referenced `currency` mocking logic directly — the workaround pattern (see below) had to be copy-pasted into every file that touched currency lookups.
- `prisma.expense.updateMany is not a function` when a service function (`removeMemberFromGroup`) started using a Prisma method the setup factory's `expense` block didn't happen to include.
- Debugging `Object.keys(prisma)` inside a throwaway test showed only `['expense', 'user', 'group', 'category', 'emailVerificationToken', '$transaction']` — a strict subset of the real generated Prisma client's models/methods, and the exact list matched `setup.ts`'s factory shape, not automock's.

## What Didn't Work

- Adding a per-file workaround (`if (!(prisma as any).currency) { (prisma as any).currency = { findUnique: jest.fn() }; }`) worked, but had to be duplicated in three separate test files (`expenseService.test.ts`, `groupService.test.ts`, `currencyController.test.ts`) as each one independently hit the same gap for a different missing model/method. This is a symptom of not understanding the actual root cause — it patches each call site instead of the shared setup.
- Running `npx prisma generate` and clearing the Jest cache (`npx jest --clearCache`) in case the generated client itself was stale — this fixed an unrelated, real staleness issue (the `Currency` model genuinely wasn't in the generated client yet) but did not explain why `prisma.currency` was *still* missing after regenerating and confirming the real client has it.

## Solution

Jest's module registry treats the *first* `jest.mock('../lib/prisma', factory)` call for a given module path as authoritative for that test file's run. `setupFilesAfterEnv` files execute before a test file's own imports (and therefore before its own `jest.mock()` calls), so the setup file's factory-based mock is registered first and a later bare `jest.mock('../../lib/prisma')` in the test file is effectively a no-op — Jest does not automock over an already-mocked module.

Fix: treat `backend/src/__tests__/setup.ts` as the single source of truth for the Prisma mock shape, and add any missing model or method **there** rather than patching individual test files:

```ts
// backend/src/__tests__/setup.ts
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    expense: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(), // added when removeMemberFromGroup started using it
    },
    // ...
    currency: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));
```

Once `currency` and `expense.updateMany` were added to this one file, the three separate per-file workarounds were deleted with no behavior change (308 backend tests still pass).

## Why This Works

Jest's `moduleRegistry` mock map is keyed by resolved module path, and the first registration for a path in a given test file's module graph sticks — a plain `jest.mock('somepath')` call with no factory checks whether the module is already mocked before falling back to automock, and `setupFilesAfterEnv` runs strictly before the test file's own top-level code (including its `jest.mock()` calls, despite Babel/ts-jest hoisting `jest.mock()` calls to the top of the file — hoisting only reorders within the file, not across the setup-file boundary). So the setup file's explicit factory is what every test file actually gets, regardless of what any individual test file's own `jest.mock()` call looks like.

## Prevention

- When a test fails with "X is not a function" or "Cannot read properties of undefined" on a Prisma delegate, and the test file has `jest.mock('.../lib/prisma')` with no factory, check `backend/src/__tests__/setup.ts` first — it is very likely the actual mock source, not automock.
- Add new Prisma models/methods to `setup.ts`'s factory as soon as a service starts using them, rather than patching around the gap in the individual test file that happens to hit it first. A gap in this file affects every backend test file, not just the one that surfaced it.
- If truly one-off, per-file mock behavior is needed for a specific test, use `jest.mock('../../lib/prisma', () => ({ ... }))` **with an explicit factory** in that file — a factory-based mock, unlike a bare `jest.mock()`, does register and is respected in that file's own module graph (this is a different code path from the silently-ignored bare-mock case documented above).

## Related Issues

None yet — this is the first documented solution in this repo's `docs/solutions/`.
