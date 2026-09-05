---
title: "Fix branches with committed, working commits sat unmerged across three sessions"
date: 2026-08-09
last_updated: 2026-09-03
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

**Update 2026-09-03 — same failure mode, different shape: an *open PR*, not just an unmerged
branch.** A `git branch --no-merged master` audit (prompted by the user asking "how many such
unmerged code we have in diff places") found PR #28 (head branch `docs/priority-note-ci-plan-and-intelligence-layer-plan`, since deleted
after merge)
had been open, unreviewed, and unmerged for 2 days — a real feature plan (the "intelligence layer"
doc) plus a priority note that itself said "finish the CI plan before starting new work," sitting
invisible on a branch nobody revisited. The original guidance below (`git for-each-ref` /
`git log master..<branch>`) would have caught this too, but the audit also surfaced a **false-positive
trap** the original check doesn't guard against: 4 other branches showed up as "unmerged" by that
same check but were actually already-squash-merged (their content is on `master`, just under a
different, rewritten commit SHA) — `git log`-only auditing can't tell a real orphan from this git-log
artifact, and incorrectly flagging (or worse, re-merging) a squash-merged branch wastes a full
session on non-existent work. See the refined check below.

## Guidance

At the start of any session touching this repo (and especially before reporting "current status"
to the user), check for stranded work, not just the current branch — and check both local and
remote branches, plus open PRs, since orphaned work can be a branch nobody pushed *or* a PR nobody
merged:

```bash
git branch --no-merged master
git branch -r --no-merged origin/master
```

**Then, for each hit, distinguish a real orphan from a squash-merge false positive before acting**
— `--no-merged` flags a branch as unmerged whenever its exact commits aren't reachable from
`master`, which is also true of a branch that squash-merged cleanly (the content landed, but under
a new commit hash the branch itself never advanced to):

```bash
gh pr list --state all --search "head:<branch-name>" --json number,state,mergedAt
```

If that returns a `MERGED` PR, the branch is stale-but-harmless (safe to delete, no real gap) — not
an orphan. Only a branch with an **open** PR, or **no PR at all**, and real diff content
(`git diff master...<branch> --stat`) is genuine stranded work worth surfacing. A branch a user
explicitly asked to pause is not resolved; it is deferred, and deferred work needs an explicit
re-visit trigger, not silent abandonment — the same is true of an open PR nobody circled back to
merge.

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
