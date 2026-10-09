---
title: A PR that conflicts with master gets no pull_request CI runs, so it looks like CI is stuck
date: 2026-10-04
category: docs/solutions/workflow-issues
module: ci
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "A push to a PR branch produces no checks and `gh pr checks` reports no checks"
  - "master has moved on since the branch was cut or last merged"
  - "Branch protection requires the branch to be up to date with master"
tags: [github-actions, pull-request, merge-conflict, ci, gh-cli, branch-protection]
---

# A PR that conflicts with master gets no pull_request CI runs, so it looks like CI is stuck

## Context

PR #90 was pushed with new commits and CI never started. For several minutes `gh pr checks 90` printed only `no checks reported on the 'feat/theme-label-ux-autocomplete' branch`, and `gh run list --branch ...` showed only the run for the previous head. The pipeline looked broken or slow, but nothing was wrong with it.

## Guidance

When a push to a PR branch produces no checks, look at mergeability before looking at the workflow:

```bash
gh pr view <N> --json mergeable,mergeStateStatus --jq .
# {"mergeStateStatus":"DIRTY","mergeable":"CONFLICTING"}  <- this is the cause
git merge-tree --write-tree --name-only origin/<branch> origin/master
# lists the conflicting files without touching any checkout
```

GitHub does not run `pull_request` workflows for a PR it cannot merge into its base. This repo's `.github/workflows/ci.yml` triggers only on `pull_request` with `branches: [master]` (lines 4 and 6), so a conflicting PR gets no CI at all and shows no failure either.

Fix it with a merge, not a rebase and not a force push, in an isolated worktree:

1. `git worktree add --detach <path> origin/<branch>`
2. `git merge --no-commit --no-ff origin/master`, resolve the conflicts, `git add`
3. Re-run `tsc` and both test suites on the merged result before committing the merge
4. Commit, then push as a plain fast-forward (`git push origin HEAD:<branch>`) after confirming the remote branch has not moved

The conflict that blocked PR #90 was one line in the root `package.json`: the `test:gate` script. PR #90 added `scripts/__tests__/eas-release-notes.test.js` (a file that exists only on that PR's branch until it merges) and master had added `.claude/hooks/__tests__/pre-commit-quality-gate.test.js` (on master; absent from an out-of-date checkout). Keeping both entries was the correct resolution. Once the merge was pushed, CI started within seconds and `mergeStateStatus` became `CLEAN`.

## Why This Matters

The symptom (silence) is indistinguishable from a slow or stuck runner, so it is easy to wait, re-push, or start debugging workflow YAML. The check takes one command. Separately, the repo's branch protection requires the branch to be up to date with master, and auto-merge is not enabled (`gh pr merge --auto` fails with `Auto merge is not allowed for this repository`), so a PR that falls behind needs a manual update either way (`gh pr update-branch <N>` for the non-conflicting case).

## When to Apply

- No checks appear within about a minute of a push to an open PR
- Another PR merged to master touching a file your branch also changed (shared config such as root `package.json` scripts is a frequent collision point)

## Examples

- PR #88: `gh pr merge --squash` was refused with `the head branch is not up to date with the base branch`; `gh pr update-branch 88` fixed it and CI re-ran.
- PR #90: `CONFLICTING` / `DIRTY` on `package.json`; resolved by a merge commit, CI then ran and every check passed.

## Related

- `docs/solutions/workflow-issues/fix-branches-orphaned-across-sessions.md`
- `docs/solutions/workflow-issues/isolated-worktree-agent-branches-from-master-not-current-branch.md`
