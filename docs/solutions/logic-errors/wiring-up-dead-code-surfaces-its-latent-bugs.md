---
title: "Wiring up previously-dead-code (deleteGroup, deactivateGroup) surfaced two real, previously-invisible bugs"
date: 2026-09-18
category: docs/solutions/logic-errors
module: groupService (frontend + backend)
problem_type: logic_error
component: dead_code
symptoms:
  - "deleteGroup() (frontend) and deactivateGroup() (backend) both had real bugs that produced zero visible symptoms, because nothing in the app ever called them"
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components: ["frontend_service", "error_handling"]
tags: [dead-code, testing, delete, groups]
---

# Wiring up previously-dead-code surfaced two real, previously-invisible bugs

## Problem

Issue #47 asked for a delete-group UI. The backend endpoint (`DELETE /api/groups/:id`) and a frontend service wrapper (`deleteGroup()` in `groupService.ts`) already existed -- but no screen or component anywhere called either the wrapper or exposed a delete action, so this whole path was dead code, exercised by nothing.

The moment it was wired into a real UI button, two real bugs surfaced immediately:

1. Frontend `deleteGroup()` returned the raw `{ success, data, message }` response envelope instead of unwrapping it (`return response.data` instead of `response.data.data`) -- the same bug class as issue #44's `updateGroup()`, already logged separately as issue #59 while it was still unreachable.
2. Backend `deactivateGroup` threw raw `Error` instead of `AppError` for its not-found/unauthorized cases -- invisible because nothing ever triggered those paths through a real request that reached the global error handler in a way anyone would notice the wrong status code.

## Why This Matters

Dead code is not neutral -- it's not "safe because unused," it's actively **untested by construction**: no manual QA pass, no E2E flow, no user ever exercises it, so any bug in it survives indefinitely with zero signal. The bug doesn't appear until the exact moment someone finally wires it up, at which point it looks like a "new" bug introduced by that change, when really it was latent from whenever the dead code was first written.

## Solution

Both bugs were fixed in the same PR that did the actual wiring (issue #47's PR), not treated as separate, deferred issues -- because once the code path becomes reachable, the bugs are directly causally connected to that PR's correctness (the feature genuinely doesn't work without both fixes), not unrelated pre-existing issues to log-and-skip.

## Prevention

- When a task involves wiring up an existing-but-unused function (a service wrapper, a controller, a helper), don't assume it "already works" because it compiles and has no open bug reports -- an unreported bug in code nothing calls looks identical to no bug at all. Test it as if it were brand new.
- When `/code-review` or a static read-through finds the *same bug class* in a sibling function that's still dead code (here: `getGroups()` in the same file has the identical envelope-unwrap bug as `deleteGroup()` did), that's worth filing as its own issue (see #59) rather than fixing preemptively -- but treat it as a real, load-bearing finding, not noise, since the exact same "looks fine until wired up" trap applies to it too.

## Related Issues

- GitHub issue #47 (this fix).
- GitHub issue #44 / `docs/solutions/logic-errors/update-group-response-envelope-not-unwrapped.md` -- the original instance of the envelope-unwrap bug class, in code that *was* wired up.
- GitHub issue #59 -- `getGroups()`'s still-dead-code instance of the same envelope-unwrap bug, not yet wired up or fixed.
