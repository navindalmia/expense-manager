---
title: "Maestro E2E flow files used commands that never existed in real Maestro syntax"
date: 2026-08-22
category: docs/solutions/test-failures
module: maestro-flows
problem_type: test_failure
component: testing_framework
severity: medium
symptoms:
  - "`maestro check-syntax` failed on every one of the 8 test-case flows and several shared flows with errors like 'Invalid Command: setVariable', 'Invalid Command: callAPI', 'Unknown Property: timeout', 'Config Field Required: link'"
  - "The flows had never been run since being written (2026-05-20) — ROADMAP.md had flagged them as 'never confirmed to actually run'"
root_cause: wrong_api
resolution_type: test_fix
tags: [maestro, e2e-testing, mobile, yaml, hallucination]
---

# Maestro E2E flow files used commands that never existed in real Maestro syntax

## Problem

`maestro-flows/*.yaml` (8 test-case flows plus 4 shared flows, written 2026-05-20) used several YAML commands — `setVariable`, `callAPI`, `assertNotEmpty`, a generic `assert: condition:` form, an `if:/commands:` block, an inline `timeout:` property on `assertVisible`, and a bare `wait: <ms>` command — that do not exist in real Maestro (CLI v2.8.0) syntax at all. This wasn't version drift from an older Maestro release; these commands were never real.

## Symptoms

- `maestro check-syntax maestro-flows/<file>.yaml` failed on every file with errors such as `Invalid Command: setVariable`, `Invalid Command: callAPI`, `Unknown Property: timeout` (on `assertVisible`), and `Config Field Required: link` (on `openLink`, which was using `url:` instead)
- The flows had literally never been executed since being authored — `ROADMAP.md` already flagged them as "never confirmed to actually run, never wired into any npm script or CI"

## What Didn't Work

Nothing was attempted before the direct fix — the failure was caught immediately by running `maestro check-syntax` against each file individually and reading one error at a time, rather than assuming the flows were merely stale from a Maestro version change.

## Solution

Verified the real syntax by dispatching a research agent against `docs.maestro.dev` directly (not memory), then applied these mappings across all 12 files:

| Fabricated command | Real Maestro equivalent |
|---|---|
| `setVariable:` | `evalScript: ${output.<var> = <js expression>}` |
| `callAPI:` (method/url/body/variable) | `evalScript:` using Maestro's built-in `http.get/post/delete(...)` client, storing the parsed result on `output.<var>` |
| `assertNotEmpty:` / `assert: condition:` | `assertTrue: condition: ${<js boolean expression>}` |
| `if: <cond> commands: [...]` | `runFlow: when: true: ${<cond>} commands: [...]` |
| `assertVisible: text: ... timeout: N` | `extendedWaitUntil: visible: text: ... timeout: N` immediately followed by a plain `assertVisible:` on the same text |
| bare `wait: <ms>` | removed — `assertVisible`'s own built-in retry/wait already covers the intent; an arbitrary sleep only adds flakiness risk |
| `openLink: url: ...` | `openLink: link: ...` (the field is literally named `link`, not `url`) |
| `runFlow: <FlowName>` + a `params:` block | `runFlow: file: <shared-flow-file>.yaml` + `env:` (Maestro resolves sub-flows by file path, not by the flow's internal `name:` field, and passes parameters via `env:`, not `params:`) |

Example, before and after (`shared-verify-email-state.yaml`):

```yaml
# Before (fabricated)
- callAPI:
    method: POST
    url: "http://localhost:4000/api/internal/verify-user"
    body:
      email: ${email}
    variable: userState
- assert:
    condition: "${userState.emailVerified} == ${expectedEmailVerified}"

# After (real Maestro)
- evalScript: |
    const response = http.post('http://localhost:4000/api/internal/verify-user', {
        body: JSON.stringify({ email: '${email}' }),
        headers: { 'Content-Type': 'application/json' }
    });
    const userState = json(response.body);
    output.userEmailVerified = userState.emailVerified;
- assertTrue:
    condition: ${output.userEmailVerified == expectedEmailVerified}
    label: "User ${email} emailVerified should be ${expectedEmailVerified}"
```

Result: `maestro check-syntax` passes cleanly on all 12 files (verified by running the checker against every file individually, not just the first one).

## Why This Works

Maestro's actual command set is narrower and more JS-centric than the fabricated flows assumed — most "logic" (variables, conditionals, API calls, custom assertions) goes through `evalScript`/`assertTrue` with real JavaScript, not dedicated YAML keywords for each concern. The fabricated flows read as if authored by inferring Maestro's API from a general sense of "what a YAML-based mobile testing DSL probably looks like" rather than from Maestro's actual documented command set — none of the invented commands (`setVariable`, `callAPI`, `assertNotEmpty`, a generic `assert:`, `if:/commands:`) are close synonyms of real Maestro syntax; they're plausible-sounding inventions.

## Prevention

- **Run `maestro check-syntax <file>` (or the equivalent for any DSL-based test framework) immediately after writing a flow, before assuming it's correct.** This repo's flows sat unvalidated for 3 months because nothing forced a syntax check at authoring time.
- When unsure whether a command in a niche testing DSL is real, verify against the framework's own docs directly (or a research agent that fetches them) rather than inferring the API shape from general knowledge — the errors here were not typos, they were entirely invented commands that happened to look plausible.
- Consider wiring `maestro check-syntax` into CI once flows are stable, so a future syntax regression is caught on the next PR rather than the next multi-month-later manual run.
