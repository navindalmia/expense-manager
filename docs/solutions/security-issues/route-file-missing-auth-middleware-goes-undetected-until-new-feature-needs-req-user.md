---
title: "A route file with no auth middleware at all goes undetected until a new feature needs req.user"
date: 2026-09-05
category: security-issues
module: backend/src/routes/categoryRoutes.ts
problem_type: security_issue
component: authentication
symptoms:
  - "A route file's own comments explicitly say \"No authentication required (public data)\" for an endpoint whose data is not actually meant to be public"
  - "A new feature that reads req.user.id on that route would either crash (req.user is undefined) or silently write a row with no real owner, depending on how defensively the new code is written"
  - "gh code review personas (feasibility-reviewer and security-lens-reviewer independently) flag the same route file for the same missing-auth-middleware reason, from two different angles (functional correctness vs. security exposure)"
root_cause: missing_permission
resolution_type: code_fix
severity: critical
tags: [auth-middleware, route-registration, ownership-model, ce-doc-review, ce-plan]
---

# A route file with no auth middleware at all goes undetected until a new feature needs req.user

## Problem

`backend/src/routes/categoryRoutes.ts` had **no `authMiddleware` on either of its two routes at all** — `GET /api/categories` and `POST /api/categories` were both fully public, unlike every other route file in the repo (`groupRoutes.ts`, `expenseRoutes.ts`), which apply `authMiddleware` on every route. The gap was invisible for as long as the category endpoints genuinely had nothing user-specific to protect (a flat, global, admin-seeded category list). It only became a real security bug the moment a new feature (the intelligence-layer plan's user-extensible categories, `docs/plans/2026-08-31-001-feat-intelligence-layer-themes-labels-autocomplete-plan.md`) needed `req.user.id` to attribute ownership of a newly-created row.

## Symptoms

- The route file's own header comment for `GET /` reads "No authentication required (public data)." — accurate when written, silently wrong once the data model changes to include per-user rows.
- Planning the new feature (`/ce-plan`) assumed `req.user.id` would be available in the controller, because every other controller in the codebase gets it that way. It would not have been, without this fix.
- Running `/ce-doc-review` on the resulting plan surfaced this **from two independent personas** at confidence 100: `feasibility-reviewer` (verified live against the actual route file — "the controller crashes on the very first call") and `security-lens-reviewer` (framed as an authorization/data-exposure issue — "any anonymous, unauthenticated caller will be able to enumerate every user's custom category names"). Same root fact, two different failure framings, both correct.

## What Didn't Work

Nothing was attempted and abandoned here — the gap was caught during planning (`/ce-doc-review`) rather than during implementation or in production, which is the point of this doc. The counterfactual worth naming: had the plan been implemented as originally drafted (before doc-review ran), `categoryController.createCategory`/`getCategories` would have called `req.user!.id` on a request that never went through `authMiddleware` — `req.user` would be `undefined`, and the non-null assertion (`req.user!.id`) would either throw a raw runtime error (not an `AppError`, so it would surface as an unhandled 500 with no clean error message) or, if the code were written more defensively with an `?? null` fallback instead of `!`, silently create a category owned by `null` (indistinguishable from a real system/global category) that any unauthenticated caller could inject.

## Solution

Add `authMiddleware` to every route in the file, matching the pattern already used everywhere else in the codebase:

```ts
// backend/src/routes/categoryRoutes.ts -- before
router.get('/', categoryController.getCategories);
router.post('/', categoryController.createCategory);

// after
import { authMiddleware } from '../middlewares/authMiddleware';

router.get('/', authMiddleware, categoryController.getCategories);
router.post('/', authMiddleware, categoryController.createCategory);
router.patch('/:id/disable', authMiddleware, categoryController.disableCategory);
```

The controller and service layer were also rewritten to actually use `req.user.id` (via a new `categoryService.ts` implementing the ownership model), rather than just adding the middleware without anything consuming it.

## Why This Works

The `authMiddleware` -> `req.user` -> service-layer ownership-filter chain only exists if every link is present. A missing link at the very first stage (the route registration) is invisible from every other layer: the controller code can look completely correct (`const userId = req.user!.id`), the service code can look completely correct (`WHERE userId IS NULL OR userId = :userId`), and the bug is still there, purely because nothing upstream ever populated `req.user` in the first place. This is why the fix belongs in the route file, not the controller — no amount of controller-level defensiveness (null checks, optional chaining) fixes the underlying problem of an unauthenticated request reaching a handler that assumes it isn't.

## Prevention

- **When a plan adds a `req.user`/ownership dependency to an existing endpoint, explicitly verify that endpoint's route file has auth middleware — don't assume it does because every *other* route file does.** One inconsistent file is exactly the kind of gap a codebase-wide "we always do X" assumption misses.
- **A route file's own comments claiming "no auth required" for a specific reason (e.g. "public data") are a signal to re-verify, not to trust, the moment a plan changes what that data represents.** The comment was true when written; code changes elsewhere can silently invalidate the premise it was based on.
- Add a route-level integration test asserting 401 on an unauthenticated request whenever a route gains a new auth dependency — this repo now has one for `categoryRoutes.ts`'s pattern (`categoryController.test.ts`'s error-path tests forward `AppError`s to `next()` rather than swallowing them; a full supertest-based route integration test would catch the missing-middleware case even more directly, and is a good candidate for the next auth-adjacent unit).
- If running `/ce-doc-review` on a plan that adds `req.user` usage to an existing controller, this is exactly the class of finding `feasibility-reviewer` and `security-lens-reviewer` are each independently designed to catch — do not skip doc-review on the theory that "this is just extending an existing pattern," since the existing pattern is precisely where the gap was hiding.

## Related Issues

None yet — first documented security-issue in this repo's `docs/solutions/`.
