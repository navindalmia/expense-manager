---
title: Verify claimed HTTP status codes against a running server; invalid theme/label names return 500, not 400
date: 2026-10-04
category: docs/solutions/best-practices
module: backend
problem_type: best_practice
component: testing_framework
severity: low
applies_when:
  - "A review, test, or summary claims an endpoint returns a specific 4xx status"
  - "Controller tests call the handler function directly instead of going through the Express router and error middleware"
  - "A controller validates input with Zod and forwards errors with next(error)"
tags: [express, zod, error-handling, http-status, live-probe, unit-test-blind-spot]
---

# Verify claimed HTTP status codes against a running server; invalid theme/label names return 500, not 400

## Context

During the PR #90 review it was stated that a whitespace-only theme or label name is "now rejected with a 400". Unit tests agreed: the controller tests call the handler directly and see a thrown validation error. A live probe against the running backend showed the real behavior:

```
POST  /api/themes      {"name":"   "}  -> 500 {"error":"Erreur interne du serveur.","code":"INTERNAL_SERVER_ERROR"}
POST  /api/themes      {"name":""}     -> 500
POST  /api/themes      {}              -> 500
PATCH /api/themes/:id  {"name":"  "}   -> 500
PATCH /api/labels/:id  {"name":"  "}   -> 500
```

## Guidance

A status code is a property of the whole request path (route, middleware, controller, error handler), so only a request through that path proves it. Before writing a status code in a review, PR description, or doc, curl the running server. For validation specifically:

- `themeController` and `labelController` call `validateThemeNameInput` / `validateLabelNameInput` and forward failures with `next(error)` in a try/catch (e.g. `createTheme` validates at `backend/src/controllers/themeController.ts:24`).
- `backend/src/middlewares` has no `ZodError` handling at all. Controllers that return 400 do it themselves: `authController.ts:125` and `:267` catch `instanceof ZodError`, and `expenseController.ts` imports `ZodError`.
- So the 500 predates PR #90 and is inherited by its new rename endpoints.

## Why This Matters

Direct-handler unit tests cannot see the error middleware, so they pass while clients get 500s. Here the user impact is small (the app's rename modal blocks empty names client-side), but a wrong status code in a PR description erodes trust in the rest of it, and over-length or malformed input from any other client does return 500 and may page someone or pollute error logs.

## When to Apply

Any claim about response codes, and any new endpoint that validates with Zod.

## Examples

Probe pattern used: log in with a throwaway account, then `curl -s -o /dev/null -w "%{http_code}" -X POST ... -d '<bad input>'` for blank, empty, and missing-field bodies.

Status as of 2026-10-04: **not fixed.** The proposed fix is a single mapping of `ZodError` to a 400 response in the global error handler, so every controller benefits. It was deliberately left out of PR #90 and is a follow-up.

## Related

- `docs/solutions/test-failures/prisma-mock-factory-precedence.md` (another case where mocks hide real behavior)
