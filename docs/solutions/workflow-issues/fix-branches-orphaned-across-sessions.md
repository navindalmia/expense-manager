---
title: "Fix branches with committed, working commits sat unmerged across three sessions"
date: 2026-08-09
category: workflow-issues
module: git workflow / session handoff
problem_type: workflow_issue
component: dev_workflow
tags: [git, branches, session-handoff, pr, technical-debt, accountability]
---

# Fix branches with committed, working commits sat unmerged across three sessions

## Context

On 2026-08-01, a session built 10 real fix commits on `fix/split-live-update-and-member-edit`
(split-calc rounding, live-update, settlement-currency bug, etc.), each with tests, then was
explicitly paused by the user mid-session ("u are messing eeryting... log these bugs and wrap
up") before merging. The branch was never merged.

Two later sessions (same week) landed *other* fixes via a separate PR (#7, merged), but neither
came back to close out the paused branch — there was no prompt, check, or habit that surfaced
"you have an open branch with committed, tested fixes nobody merged." The gap was invisible
until the user hit a bug in production (Settlement screen showing USD for a GBP group) that had
already been fixed once, on the stranded branch, over a week earlier (commit `bf5b89c`), and
asked directly: "how many fixes are orphaned? and why? u dont have an accountability?"
(that specific fix landed on `master` via PR #8, but its original commit on the stranded branch
was rewritten by the rescue rebase and is no longer reachable — cite the PR, not the old SHA)

Auditing found 12 commits orphaned this way — real fixes with tests, not WIP — including a
brand-new backend file (`splitCalculation.ts`, 66 lines + tests) that never reached `master` at
all.

## Guidance

At the start of any session touching this repo (and especially before reporting "current status"
to the user), check for stranded work, not just the current branch:

```bash
git for-each-ref --format='%(refname:short) %(committerdate:relative)' refs/heads/ | grep -v master
```

If a non-master local branch exists with commits not reachable from `master`
(`git log master..<branch> --oneline`), that is stranded work until proven otherwise — surface it
proactively, don't wait for the user to ask "where were we." A branch a user explicitly asked to
pause is not resolved; it is deferred, and deferred work needs an explicit re-visit trigger, not
silent abandonment.

Before merging a rescued branch, rebase onto current `master` first (not merge) — this cleanly
drops any commits whose patch content already landed via a different, unrelated PR in the
interim (confirmed by git during this session: `dropping ... patch contents already upstream`),
avoiding duplicate/conflicting merges without manual diffing.

## Why This Matters

Uncommunicated technical debt compounds silently: the user re-discovers a bug that was already
fixed, wastes time re-diagnosing it, and loses trust that "current status" reports are actually
complete. The fix here wasn't writing new code — the fix code already existed and was tested. The
gap was purely a missing accountability habit: nothing in the session-start routine treated an
open, unmerged branch as an anomaly worth flagging.

## When to Apply

- At the start of any session in a repo with multiple recent feature/fix branches
- Before answering "what's the current status" or "where were we" — a stale-branch check belongs
  in that answer, not just `git log` on the current branch
- After a session is explicitly paused mid-work ("wrap this up", "let's stop here") — treat the
  branch as a pending item to resurface next session, not a closed one

## Examples

Before (what happened): three sessions passed; each checked `git log`/`git status` on `master`
only, never listed other local branches, so the paused branch with working fixes was invisible
until the user hit the bug it already fixed and asked why.

After (what to do instead): run the stranded-branch check above at session start; if a non-master
branch has commits ahead of `master`, name it and its fixes explicitly in the status summary
before the user has to ask.
