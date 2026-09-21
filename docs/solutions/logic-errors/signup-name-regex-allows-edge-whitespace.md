---
title: "Signup name validation regex allowed leading/trailing/all whitespace"
date: 2026-09-18
category: docs/solutions/logic-errors
module: authSchema
problem_type: logic_error
component: schema_validation
symptoms:
  - "A name like \" John Doe\" (leading space) or \"John Doe \" (trailing space) was accepted at signup and stored with the whitespace intact"
  - "A name consisting only of whitespace (e.g. \"   \") passed validation and created a user"
root_cause: logic_error
resolution_type: code_fix
severity: low
related_components: ["validation", "auth"]
tags: [zod, validation, whitespace, signup, name]
---

# Signup name validation regex allowed leading/trailing/all whitespace

## Problem

`backend/src/schemas/authSchema.ts`'s `signupSchema` validated `name` with `.regex(/^[a-zA-Z\s'-]+$/, ...)`. `\s` matches anywhere the character class is allowed, including at the very start/end of the string, so the regex itself never distinguished "letters with internal spaces" (the intent) from "any string made of letters/spaces/hyphens/apostrophes, including one that is only spaces." Nothing upstream of the regex (no `.trim()`, no separate check) caught this either.

## Symptoms

- Filed as GitHub issue #49: "Accepts a full name starting with space."
- A name field is the only place this is set in the codebase — there is no separate profile/name-update endpoint, so the gap only existed at signup, but persisted for the account's lifetime once created.

## Root Cause

Zod's `.regex()` validates the string as given; it does not trim first unless a preceding `.trim()` transform is added to the chain. The schema had no such step, so `" John Doe"`, `"John Doe "`, and `"   "` were all valid inputs to the regex (spaces are in the allowed character class), and Zod applied no default trimming.

## Solution

Added `.trim()` immediately after `.string()` and before the `.min()`/`.regex()` checks:

```ts
name: z
  .string()
  .trim()
  .min(1, 'Name is required')
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, '...'),
```

`.trim()` runs before the subsequent checks, so: a name with edge whitespace is normalized before being measured/stored; an all-whitespace name becomes an empty string and correctly fails `.min(1, 'Name is required')` instead of passing.

## Why This Works

Zod method chaining applies transforms (`.trim()`) before the validators that follow them in the chain, so every downstream check (`min`, `max`, `regex`) sees the already-trimmed value — no separate manual trim-then-validate step is needed, and there's only one place (`signupSchema`) that needed the fix since it's the sole write path for `name`.

## Prevention

- When a Zod string field allows whitespace as a valid character (spaces within a name, address, etc.), always add `.trim()` before length/regex checks — a character class that permits the character generally will also permit it at the edges unless explicitly anchored against that.
- A regex intended to validate *content* (which characters appear) is not the same guarantee as validating *shape* (no leading/trailing padding) — the two need separate handling.

## Scope note (flagged during review, not fixed here)

This fix only applies going forward; it does not backfill any already-persisted `User.name` rows that predate this deploy. No migration/admin-tooling exists in this repo yet for ad hoc data fixes, and the app is pre-production, so this was left as a known gap rather than building one-off migration tooling for it.

## Related Issues

- GitHub issue #49.
