---
title: An Agent dispatch with worktree isolation branches from master, not the orchestrator's current feature branch
date: 2026-09-14
category: workflow-issues
module: ".claude/ orchestration (Agent tool, isolation:\"worktree\")"
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "Dispatching a parallel subagent with isolation:\"worktree\" while the orchestrating session is on a feature branch, not master"
  - "The dispatched task needs to reference or build on files that only exist on the current feature branch (not yet merged to master)"
tags: [worktree, agent-isolation, parallel-agents, feature-branch, git]
---

# An Agent dispatch with worktree isolation branches from master, not the orchestrator's current feature branch

## Context

While working on `feat/intelligence-layer-themes-labels-autocomplete` (not yet merged to `master`), two parallel `Agent` calls were dispatched with `isolation: "worktree"` to do independent work: one to wire the branch's new `e2e/intelligence-layer.spec.ts` into CI, one to build a new pre-commit hook. Both tasks completed and reported success. Checking the actual diffs before merging revealed the CI-wiring agent's worktree had been created from `master`'s tip, not from the current feature branch — so its new CI job referenced `e2e/intelligence-layer.spec.ts`, a file that only existed on the unmerged feature branch and was completely absent from the worktree's own checkout.

## Guidance

**Before trusting a worktree-isolated agent's "done" report, check which branch its worktree actually started from** (`git log --oneline -3` inside the worktree, or check the commit the agent's own report cites as its base). Do not assume it branched from the orchestrator's current branch just because that's where the dispatch happened.

When the dispatched task genuinely depends on files/state that only exist on the orchestrator's current (unmerged) branch, either:
- explicitly tell the agent which branch to base its work on in the task prompt, or
- after the agent completes, cherry-pick its commit onto the correct branch rather than trying to merge the worktree branch directly (a straight merge could pull in unrelated `master`-vs-feature-branch drift; a cherry-pick isolates just the one commit's changes)

After cherry-picking, re-verify the moved commit actually makes sense in its new context — a CI job written and self-checked in a worktree where the referenced file didn't exist has only had its YAML syntax and referenced-command existence checked, not that the file path it points to is correct once actually reachable.

## Why This Matters

An isolated worktree is specifically meant to let a subagent work without disturbing the orchestrator's own checkout — but "isolated" here silently meant "isolated from the current branch too," not just "isolated from uncommitted changes." A subagent's own self-test (e.g., validating its YAML/that referenced scripts exist) can pass cleanly and still be operating against the wrong branch's file tree, so a clean self-report is not sufficient evidence the result is usable as-is.

## When to Apply

- Any time a worktree-isolated `Agent` dispatch happens while the orchestrating session is on a non-default branch, especially when the task references files added earlier in that same branch's history.
- Before merging or cherry-picking any worktree-isolated agent's commit — always inspect `git log`/`git diff` in the worktree first, not just the agent's own summary.

## Examples

```bash
# After an Agent(isolation:"worktree") dispatch completes, before trusting it:
cd .claude/worktrees/agent-<id>
git log --oneline -3   # confirm the base commit -- was it master or your feature branch?
ls e2e/ 2>&1           # spot-check: does a file the task should have needed actually exist here?
```

If the worktree branched from the wrong base:

```bash
cd <main-repo-checkout>
git checkout <your-actual-feature-branch>
git cherry-pick <agent-commit-sha>   # not a merge -- isolates just this one commit
# re-verify: does the cherry-picked change still make sense now that the
# files it references actually exist in this tree?
```

## Related

- This session's two other parallel worktree-agent dispatches (a pre-commit-hook build, a doc-staleness scrub run in a tandem live session rather than a worktree) did not hit this issue — the hook build touched only `.claude/` files with no branch-specific dependency, and the tandem session shared the same checkout/branch as the orchestrator rather than an isolated worktree.
