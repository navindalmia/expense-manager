---
title: "A PreToolUse hook registered with matcher Bash(git commit*) never ran, so the pre-commit gates were dead"
date: 2026-10-09
category: docs/solutions/integration-issues
module: .claude/hooks (pre-commit gates)
problem_type: integration_issue
component: development_workflow
symptoms:
  - "pre-commit-gate.js (tsc) and pre-commit-quality-gate.js (UI needs E2E, fix needs a test) never blocked or even ran on any commit"
  - "Both scripts had passing unit tests, so nothing looked wrong"
  - "A required step (the real /ce-code-review) was skipped and no hook objected"
root_cause: config_error
resolution_type: config_change
severity: high
tags: [claude-code, hooks, pretooluse, matcher, regex, pre-commit-gate, silent-failure, config-test]
---

# A PreToolUse hook registered with matcher Bash(git commit*) never ran, so the pre-commit gates were dead

## Problem

`.claude/settings.json` registered both commit gates under `matcher: "Bash(git commit*)"`. For a `PreToolUse` hook, `matcher` only filters on the **tool name**. A value made only of letters, digits, `_`, `-`, `,`, `|` and spaces is an exact tool-name list; anything else is treated as an unanchored JavaScript regex over the tool name. `Bash(git commit*)` therefore needs a literal `(` in a tool name, and the only tool is `Bash`, so the hook could never fire. The tsc gate and the E2E/test-required gate had never run on any commit in any session (confirmed against the Claude Code hooks reference: "Matcher patterns" and the hook `if` field).

## Symptoms

- No commit was ever blocked by either gate, including commits that skipped the real `/ce-code-review` and the Maestro baseline.
- The gate scripts' own `node --test` suites stayed green, because they test the script given an input, not whether Claude Code ever calls it.
- The first theory was wrong: the matcher was assumed to be a command prefix that only failed on compound commands (`cd x && git add && git commit`). It never matched at all.

## What Didn't Work

- **Trusting the unit tests.** `.claude/hooks/__tests__/pre-commit-quality-gate.test.js` exercised the rules but nothing exercised the wiring.
- **Assuming permission-rule syntax works in `matcher`.** `Bash(git commit*)` is permission-rule syntax; it belongs in the hook's separate `if` field, not in `matcher`.
- **Keeping an `if` as well.** The first fix used `matcher: "Bash"` plus `if: "Bash(git *commit*)"`. Review showed the `if` was a second, independent filter that could itself skip the gate for forms it did not match, so it was removed.

## Solution

Before (`.claude/settings.json`):

```json
{ "matcher": "Bash(git commit*)", "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/pre-commit-gate.js\"" } ] }
```

After (PR #96): register on the plain tool name and let each script decide whether the command is a commit:

```json
{ "matcher": "Bash", "hooks": [ { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/pre-commit-gate.js\"" } ] }
```

Both scripts start with `if (!isGitCommit(command)) process.exit(0)`, using `.claude/hooks/lib/is-git-commit.js`: a deliberately over-inclusive regex (`git` as a word, then anything up to a separator, then whitespace, `commit`, whitespace or end) that covers compound commands, quoted `-C`/`-c` values, `--git-dir x`, short flags, an absolute git path, subshells and `bash -c "..."`, while still ignoring `git commit-tree` and `git log --grep=commit`.

## Why This Works

`Bash` is an exact tool-name match, so the hook now runs for every Bash call. Filtering by command moves into the script, which sees the real command string on stdin and fails fast (exit 0) for anything that is not a commit, so the cost is one short node start per Bash call. An over-inclusive detector can only cause an extra harmless check; an under-inclusive one silently skips the gate, which is the failure that matters for a guard.

## Prevention

- **Test the wiring, not just the script.** `.claude/hooks/__tests__/hook-config.test.js` (in `npm run test:gate`) asserts every hook matcher in `settings.json` is a plain tool-name list (`/^[A-Za-z0-9_|, -]*$/`), that both gates are registered under `Bash`, the `isGitCommit` positive and negative cases, and that a commit command (plain, compound, quoted `-C`) reaches the gate logic and exits 2 on a staged `fix(` with no test. Verified red on the old matcher and the old detector.
- **Prove a guard fires live once.** After merging, a throwaway branch with a non-test file staged and `git commit -m "fix(probe): ..."` was refused by the gate in a real session. Unit tests cannot show this.
- **A hook can only check what it can see.** No hook can prove `/ce-code-review` or `/ce-compound` ran; those stay discipline.
- **Open limits (not fixed here, tracked in ROADMAP 5d):** the gate resolves the target repo only from `git -C <path>`, not from `cd <path> &&`, so it checks the hook's own repo for a commit in another repo; and `extractCommitMessage` scans the whole command text for `-m "..."`, so a script or heredoc that merely mentions `-m "fix(..."` makes a non-fix commit look like a fix. The gate also reads the message only from `-m` flags and the staged list at hook time, so heredoc (`-F -`) messages and `git add && git commit` in one command still fail open; the git-level hooks and CI `regression-gate` are the backstop.

## Related Issues

- PR #96 (the fix), PR #95 (added the SessionStart recall hook that surfaces this docs folder).
- `docs/solutions/tooling-decisions/adversarially-hardening-merge-blocking-gates.md`: why a gate needs adversarial review; this bug is the case where the gate never ran at all.
- `docs/solutions/tooling-decisions/visual-regression-hook-uses-exempt-trailer-not-hard-block.md`
