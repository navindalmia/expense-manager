---
title: "AppError's messageKey must be a real i18n key -- a literal English sentence silently regresses translation"
date: 2026-09-18
category: docs/solutions/logic-errors
module: groupService / errorHandler / i18n
problem_type: logic_error
component: error_handling
symptoms:
  - "A newly-added AppError, copied from a sibling function's existing (already-buggy) pattern, displays untranslated English text to French-locale users"
root_cause: logic_error
resolution_type: code_fix
severity: low
related_components: ["i18n", "error_handling"]
tags: [i18n, AppError, error-handling, translation, code-review]
---

# AppError's messageKey must be a real i18n key -- a literal English sentence silently regresses translation

## Problem

While wiring up issue #47's delete-group UI, `groupService.deactivateGroup` was fixed to throw `AppError` instead of raw `Error` (see the sibling `deactivateGroup-raw-error` context in issue #47's PR). The new `AppError` calls used literal English sentences as the `messageKey` argument, e.g. `new AppError('Group not found', 404, 'GROUP_NOT_FOUND', ...)` -- copied directly from `updateGroup`'s existing (pre-existing, unfixed) pattern in the same file, which looked like "the established convention."

## Symptoms

Not caught by manual testing (which only exercised the English locale) -- caught by a `/code-review` pass, which reasoned through the French-locale path explicitly.

## Root Cause

`backend/src/middlewares/errorHandler.ts` does:

```ts
if (err instanceof AppError) {
  const message = i18next.t(err.messageKey, { lng: lang });
  return res.status(err.statusCode).json({ error: message, ... });
}
```

`i18next.t()` on a string that isn't a real resource key (no dot-namespaced match, e.g. `"Group not found"` instead of `"GROUP.NOT_FOUND"`) falls back to returning the input string unchanged -- so a French user sees the literal English sentence. This is *worse* than the raw-`Error` behavior it replaced: a raw `Error` isn't `instanceof AppError`, so it fell through to the handler's generic-error branch, which uses a real, properly-translated key (`GENERAL.INTERNAL_SERVER_ERROR`). Fixing "throws the wrong error type" without also fixing "throws the wrong shape of messageKey" traded a correctly-translated-but-generic message for a precisely-worded-but-permanently-untranslated one.

The deeper trap: `updateGroup` in the same file already had this exact bug (literal-string messageKey), untouched and unnoticed, so copying its pattern for consistency propagated the bug into new code instead of fixing it.

## Solution

Added real i18n keys (`GROUP.NOT_FOUND`, `GROUP.DELETE_UNAUTHORIZED`, `GROUP.DELETE_FAILED`) to both `backend/src/locales/en/translation.json` and `.../fr/translation.json`, matching the convention `createGroup`'s own `AppError` calls already correctly use (`GROUP.NAME_REQUIRED`, `GROUP.CURRENCY_NOT_FOUND`, etc.) elsewhere in the very same file. Switched `deactivateGroup` to use them.

## Why This Works

`i18next.t('GROUP.NOT_FOUND', { lng: 'fr' })` now resolves to a real translated string in both locale files, exactly like the sibling `createGroup` function's errors already did -- there is nothing special about `deactivateGroup`; it just needed the same treatment.

## Prevention

- When adding a new `AppError(...)` call, check whether its `messageKey` is a real, dot-namespaced key present in **both** locale files -- not just plausible-looking English text. `grep` the locale JSON for the key before assuming it exists.
- "Match the existing pattern in this file" is not a substitute for checking whether the existing pattern is itself correct -- a sibling function in the same file can have the exact same latent bug, and copying it silently doubles it rather than fixing anything.
- When fixing an error-handling bug (wrong error class, wrong status code), explicitly check the downstream consequence for every extra dimension the error touches (here: i18n translation) rather than only the dimension the original symptom was reported in (here: wrong HTTP status/generic message).

## Related Issues

- GitHub issue #47 (the delete-group UI PR this was found and fixed in).
- GitHub issue #62 -- the same file's broader catch-and-rewrap-as-AppError duplication (a related but separate, pre-existing DRY issue, not fixed here).
