---
title: "Three independent, drifted currency lists caused CNY to be offered-but-rejected and 5 real currencies to be create-only-broken"
date: 2026-09-18
category: docs/solutions/logic-errors
module: CreateGroupScreen / EditGroupModal / groupSchema / groupService
problem_type: logic_error
component: full_stack_validation
symptoms:
  - "Creating a group with currency CNY failed with \"Selected currency is not available.\""
  - "The Create Group and Edit Group currency pickers showed different options for the same app"
  - "Creating a group with currency SEK, SGD, HKD, CHF, or NZD failed at validation, even though editing an existing group's currency to any of those worked fine"
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components: ["frontend_service", "schema_validation", "state_management"]
tags: [zod, drift, source-of-truth, currency, groups, dry]
---

# Three independent, drifted currency lists caused CNY to be offered-but-rejected and 5 real currencies to be create-only-broken

## Problem

Filed as GitHub issues #50 ("selected currency not available" for CNY) and #51 ("Currency list view different between edit and create"). The Currency table in the database (seeded via `backend/prisma/seed.ts`) is the only place that should define which currencies exist (12: GBP, USD, EUR, INR, AUD, CAD, JPY, SGD, HKD, CHF, NZD, SEK). Three other places in the codebase had independently hardcoded their own, different lists:

1. `frontend/src/screens/CreateGroupScreen.tsx`: a hardcoded array of 8 codes, including `CNY` (not a real seeded currency) and missing SGD/HKD/CHF/NZD/SEK (5 real ones).
2. `frontend/src/components/EditGroupModal.tsx`: correctly fetched the live list from `GET /api/currencies` -- this one was never wrong, which is exactly why Create and Edit disagreed (#51).
3. `backend/src/schemas/groupSchema.ts`'s `createGroupSchema`: a Zod `z.enum([...])` of 9 values (the same 7 real ones as the frontend's array, plus `CNY` and `OTHER` -- neither real), applied only to `POST /groups`. `PATCH /groups/:id` (`updateGroup`) has no such Zod restriction and only ever deferred to `groupService`'s DB lookup.

## Symptoms

- CNY looked selectable in Create (list #1 included it) but always failed on submit, because it isn't a real row in the Currency table -- `groupService.createGroup`'s `prisma.currency.findUnique({ where: { code: 'CNY' } })` returned null, throwing `AppError('GROUP.CURRENCY_NOT_FOUND', ...)`, whose i18n text is literally "Selected currency is not available." (confirmed via the issue's own screenshot).
- SEK (and the other 4 missing-from-list-#1 currencies) weren't even visible as Create options, so a user could never try them there -- but the exact same codes worked fine via Edit, because Edit's request goes through `PATCH`, which never passed through the Zod enum at all.
- Fixing only the frontend list (make Create fetch live, like Edit does) surfaced the second bug immediately: once SEK became selectable in Create, submitting it hit `createGroupSchema`'s Zod enum, which doesn't include SEK, and failed with a Zod validation error before ever reaching `groupService.createGroup`'s (correct) DB lookup.

## Root Cause

Nobody was wrong to add currency validation in each of these three places individually -- the bug is that each was authored independently, at different times, with different code, instead of treating the Currency table as the single source of truth and having everything else defer to it.

## Solution

- `CreateGroupScreen.tsx`: removed the hardcoded array; now calls `getCurrencies()` (`GET /api/currencies`), same as `EditGroupModal.tsx`.
- `createGroupSchema`'s `currency` field: removed the hardcoded `z.enum([...])`, replaced with a light shape check (`z.string().trim().length(3)`) that rejects obviously-not-a-currency-code input cheaply, while deferring actual code validity to `groupService.createGroup`'s existing DB lookup -- exactly matching `updateGroup`'s already-correct behavior.
- A follow-up code-review pass caught that the frontend fix had *introduced* a new instance of the same duplication problem (both screens now had their own copy of the fetch-currencies effect) plus a silent-failure gap (a failed fetch was only logged, never shown to the user). Extracted a shared `useCurrencies()` hook used by both screens, which surfaces a real error message on failure.

## Why This Works

Once the DB's Currency table is the only place a currency's existence is decided (both API paths defer to `prisma.currency.findUnique`, and the only frontend list is fetched from the same table via `GET /api/currencies`), there is nothing left to drift out of sync -- there's exactly one list, read in exactly two forms (the frontend's cached fetch and the backend's live lookup), both ultimately backed by the same table.

## Prevention

- When the same conceptual "list of valid values" needs to be checked in more than one place (frontend UI options, backend request validation, backend business logic), pick exactly one of them to own the canonical list (usually the database, if one exists) and have every other location fetch or defer to it -- never hardcode a second copy "for now."
- A schema-level enum (Zod, etc.) is the wrong tool for validating against data that can grow (new currencies, new categories, etc.) -- it necessarily goes stale the moment the underlying table changes and nobody remembers to touch the enum too. Prefer a lightweight shape/format check at the schema layer and defer the actual existence check to the data layer that owns the real list.
- Fixing a UI-only instance of a "hardcoded list drifted from the DB" bug is worth testing with a **live E2E test** even when the fix looks purely cosmetic -- it was exactly this kind of test (submitting a previously-unavailable-in-the-UI currency end-to-end) that surfaced the second, functionally deeper bug (the backend's own separate enum) that a component-level or schema-level unit test in isolation would not have connected together.

## Related Issues

- GitHub issues #50, #51 (this fix).
- `docs/solutions/logic-errors/update-group-response-envelope-not-unwrapped.md` -- issue #44, found and fixed in the same session, also in the Create/Edit Group area.
