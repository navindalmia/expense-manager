---
title: "Maestro evalScript params are real JS variables, not \${} substitution"
date: 2026-08-23
category: docs/solutions/logic-errors
module: Maestro E2E testing
problem_type: logic_error
component: testing_framework
symptoms:
  - "GraalJS throws \"SyntaxError: Missing close quote\" when a Maestro evalScript block runs JSON.stringify({ email: '${email}' })"
  - "The evalScript step fails/errors instead of reaching COMPLETED in Maestro's step-by-step test output"
  - "The bug was undetected in committed test flows because the affected script had never executed successfully before"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [maestro, evalscript, javascript, testing, e2e, graaljs, params, template-substitution]
---

# Maestro evalScript params are real JS variables, not ${} substitution

## Problem

A multi-line `evalScript:` block in a shared Maestro flow crashed GraalJS with `SyntaxError: <eval>:1:11 Missing close quote` before it could make its HTTP call, breaking every flow that reuses this shared step to verify backend email-verification state.

## Symptoms

- `maestro test` runs referencing `shared-verify-email-state.yaml` (e.g. `tc1-signup.yaml`, `tc5-login-blocked.yaml`) failed at the `evalScript` step with `SyntaxError: <eval>:1:11 Missing close quote`, before the step ever executed the `http.post` call.
- The flow's step-by-step Maestro output showed the `evalScript` step failing/erroring rather than reaching COMPLETED.
- This was the first execution of these 8 pre-existing Maestro flows in the repo's history (per `ROADMAP.md`), so the bug had been latent and untested since the flow file was written.

## What Didn't Work

Not applicable for this specific fix — the cause was identified correctly on first read of `maestro-flows/shared-verify-email-state.yaml`, by comparing how flow `params` are consumed inside a multi-line `evalScript:` block against how Maestro's `${...}` substitution syntax is used elsewhere in the same file and in sibling flow files (see Prevention below for the contrast that made this legible).

A prior session (2026-08-22, on this same feature branch, PR #9) had already repaired these same 8 flows for entirely fabricated/invalid Maestro commands (`setVariable`, `callAPI`, a bare-name `runFlow` invocation) — see the related doc below. That session's fix for the API-calling pattern replaced `callAPI` with the real `evalScript`/`http` mechanism used here, but never investigated evalScript's own variable-scoping rules, so this bug survived that repair pass undetected.

## Solution

In `maestro-flows/shared-verify-email-state.yaml` (originally), the evalScript body built the JSON payload as:

```js
// Before — maestro-flows/shared-verify-email-state.yaml
- evalScript: |
    const response = http.post('http://localhost:4000/api/internal/verify-user', {
        body: JSON.stringify({ email: '${email}' }),
        headers: { 'Content-Type': 'application/json' }
    });
```

The fix removes the `${...}` wrapper around `email` since it is already a bare JS identifier in that scope:

```js
// After — maestro-flows/shared-verify-email-state.yaml
- evalScript: |
    const response = http.post('http://localhost:4000/api/internal/verify-user', {
        body: JSON.stringify({ email: email }),
        headers: { 'Content-Type': 'application/json' }
    });
```

(`{ email }` shorthand would work equally well.)

The flow declares its inputs via the top-of-file `params:` block (listing `email`, `expectedEmailVerified`, `expectedTokenIsUsed`), and callers supply values through `runFlow: env:` (e.g. `tc1-signup.yaml`'s `env: { email: ${output.testEmail}, ... }`). Per this session's diagnosis, those declared params are injected as real JavaScript variables directly into the multi-line `evalScript: |` block's execution scope — not accessed via Maestro's `${...}` text-substitution syntax. Writing `'${email}'` inside a JS string literal, when `email` is already bound as a real variable in that scope, is not valid JS — GraalJS parses the literal `${email}` characters as part of the string content and the interpolation breaks the quoting, producing the "Missing close quote" error.

**The same bug was found and fixed in two more files** once this pattern was understood, confirmed via a repo-wide grep for the pattern after the fix landed:
- `maestro-flows/shared-get-token-flow.yaml`: `email: '${email}'` → `email: email`
- `maestro-flows/tc7-resend-email.yaml` (two occurrences): `email: '${output.testEmail}'` → `email: output.testEmail` — same class of bug, but here the in-scope variable is `output.testEmail` (Maestro's own global `output` object, always live in evalScript scope) rather than a declared `params` entry.

A repo-wide grep (`grep -rn "'\${[a-zA-Z_.]*}'" maestro-flows/*.yaml`) confirmed no further instances remained after these fixes.

## Why This Works

`email: email` (or `email: output.testEmail`) is a syntactically valid JS object property assignment referencing the in-scope variable directly, so `JSON.stringify` can serialize it with no parse error, and the `http.post` call proceeds to execute.

## Verification

Ran `maestro test maestro-flows/tc5-login-blocked.yaml` (which transitively runs `shared-verify-email-state.yaml`). The evalScript step that previously crashed now shows as COMPLETED in Maestro's step-by-step output, confirming it runs to completion where it previously threw before ever reaching the `http.post` call. The `shared-get-token-flow.yaml` and `tc7-resend-email.yaml` fixes were applied by the same mechanical pattern but not independently live-verified this session (those flows, TC6/TC7, were not exercised) — flag for verification next time either is run.

## Prevention

- **Two distinct mechanisms, don't conflate them.** Maestro YAML has two separate ways of injecting values, and this bug came from using the wrong one inside a JS string:
  - Maestro's own outer-YAML text substitution, written `${...}`, used in `condition:` fields (e.g. `condition: ${output.userEmailVerified == expectedEmailVerified}`), `label:` fields, plain YAML string values (`env: { email: ${output.testEmail} }`), and single-line inline scripts (`evalScript: ${output.testEmail = 'e2e-test-' + Date.now() + '@example.com'}`). This is a textual pre-processing step performed by Maestro before any script runs.
  - The JS engine's own variable scope inside a multi-line `evalScript: |` block, where declared `params:` (and Maestro's global `output` object) are already bound as real JS identifiers — reference them bare (`email`, not `${email}`; `output.testEmail`, not `${output.testEmail}`).
- When writing a multi-line `evalScript: |` block that uses a declared flow `param` or the `output` object, reference it as a bare identifier — never wrap it in `${}`; that syntax belongs to Maestro's outer-YAML substitution layer, not the JS scope evalScript executes in.
- If an `evalScript` step throws a JS `SyntaxError` with no obvious cause, check first for a stray `${...}` used inside a JS string or expression where a bare variable was intended, before assuming a more exotic engine issue.
- Single-line `evalScript: ${...}` and multi-line `evalScript: |` are genuinely different forms — the single-line form is itself inside Maestro's `${}` substitution syntax, while the multi-line form is plain JS source handed directly to GraalJS. Don't assume patterns from one transfer to the other.
- After fixing one instance of this pattern, grep the whole `maestro-flows/` directory for the same shape (`'${...}'` inside a JS string in a multi-line block) — it tends to be copy-pasted across shared flow files, as it was here.

## Related Open Issue (not solved by this fix)

After this fix, the same shared flow's downstream assertion (`assertTrue: condition: ${output.userEmailVerified == expectedEmailVerified}`) still fails, even though a direct curl to the same internal API endpoint with the same test email confirms the backend returns the correct `emailVerified` value. Two follow-up hypotheses were tried and ruled out this session:
- Wrapping both sides in `String()` on the theory that Maestro `env:`-passed params always arrive as strings (so `false == "false"` fails via JS loose equality) — no observable change, ruling this out.
- Trying to inspect the runtime value via a `label:` interpolation trick (Maestro doesn't expose evalScript's `console.log` output anywhere accessible) — failed because `label:` only supports simple `${varName}` substitution, not JS expressions like `${typeof x}`.

This remains open and needs a fresh investigation pass; it is a separate root cause from the fix documented above and should not be treated as resolved.

## Related Documentation

- [`docs/solutions/test-failures/maestro-flows-used-fabricated-command-syntax.md`](../test-failures/maestro-flows-used-fabricated-command-syntax.md) — the prior session's repair of entirely invalid/fabricated Maestro commands in these same 8 flows. That doc's own example snippet for the fixed `evalScript`/`http` pattern contains the exact buggy `'${email}'` shape this doc corrects — worth a follow-up pass to update that example (see refresh recommendation).
