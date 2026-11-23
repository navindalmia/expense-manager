---
title: "Security fixes merged to staging only leave production exposed: audit master and backport minimally"
date: 2026-11-22
category: security-issues
module: backend/src/services/expenseService.ts
problem_type: security_issue
component: authentication
symptoms:
  - "GET /api/expenses on master returned every user's expenses to any logged-in caller, with the full paidBy and splitWith user records (including the password hash)"
  - "Both leaks were already fixed and green on staging (#152 for issue #151, #156 for issue #153) but master, the production branch, never received them"
  - "Cherry-picking the staging IDOR fix (#156) onto master conflicts in expenseService.ts and both translation.json files and needs groupGuards.ts from an unrelated feature (#63)"
root_cause: missing_permission
resolution_type: code_fix
severity: critical
tags: [idor, password-hash, staging-vs-master, backport, auth-audit, cherry-pick, hotfix]
---

# Security fixes merged to staging only leave production exposed: audit master and backport minimally

## Problem

This repo promotes `staging` to `master` in batches, and master is what production runs. Two security fixes (#152: stop returning the User password hash; #156: scope expense access to the caller's groups) merged to staging and passed review there, yet master kept the vulnerable code for weeks. A route-by-route auth audit of master found `GET /api/expenses` returning all users' expenses plus their full user rows. Nothing flagged it, because "fixed" was true of the branch everyone was looking at.

## Symptoms

- `getAllExpenses()` on master was a `findMany` with no `where` and `paidBy: true` (full user record); the controller called it with no user id.
- The same code on staging already took `userId` and filtered with `accessibleGroupWhere`.
- The handoff and PR lists showed the issues as fixed; only reading master's source showed otherwise.

## What Didn't Work

- Cherry-picking #156 whole: it conflicts (`expenseService.ts` four hunks, `en`/`fr` `translation.json`) and depends on `groupGuards.ts` from #63, which is not on master. It also changes behaviour (403 becomes 404, soft-deleted groups become 404) that production clients may rely on.

## Solution

Scope the backport by what master is actually missing, not by what the staging PR contained. A scratch-worktree trial cherry-pick shows the conflict surface cheaply:

```bash
git worktree add --detach <scratch> origin/master && cd <scratch>
git cherry-pick -x <staging-commit>   # then list conflicts, abort, remove the worktree
```

Result for this case:

1. **#152 applies cleanly:** cherry-picked as its own hotfix PR (#195, merged to master on 2026-11-22 as `e329a89`; confirmed with `gh pr view`, this staging checkout predates that merge).
2. **By-id expense routes were already member-scoped on master** (they throw 403 for non-members), so #156's value on master reduced to one thing: scope the list. PR #196 adds `accessibleGroupWhere(userId)` (a 6-line predicate in a new `groupGuards.ts`, the same text as staging so a later promotion merges trivially) and passes `req.user!.id` from the controller. #196 merged to master on 2026-11-22 as `fbf5b76` (confirmed with `gh pr view`; this staging checkout predates it).
3. The 403-to-404 refactor, soft-delete guards and translation keys were deliberately left for the normal staging promotion.

Prove the regression test is real by reverting only the service files to the parent commit, running the test (it must fail), then restoring them.

## Why This Works

The auth architecture here is opt-in per route: `authMiddleware` is attached route by route and authorization lives inside services (creator/member checks). A route that forgets either is public or unscoped by default, so a list route with no `where` leaks everything while every by-id route is fine. Auditing means reading each route file's middleware and each service's `where`, on the branch production runs, not trusting PR state.

## Prevention

- When a security fix merges to staging, open the master backport question in the same session: does master contain the vulnerable code? If so, queue a minimal hotfix PR.
- After any staging-only security merge, grep master for the fixed symbol (here `getAllExpenses`) before calling the issue closed.
- Run a route-by-route audit of master periodically. Other gaps found on master the same day (as of 2026-11-22): `POST /api/currencies` has no `authMiddleware` (`currencyRoutes.ts`), `/api/internal/*` is mounted whenever `NODE_ENV !== 'production'` (`app.ts`), and `jwtHelper.ts` falls back to a hardcoded `JWT_SECRET`. Staging PR #186 addresses these; it must not merge until Render's `JWT_SECRET` is at least 32 characters and `CORS_ORIGINS` is set, or the backend will not boot.
- Stage files with their own `git add` before the `git commit` command: the commit gate cannot see files staged in the same command and wrongly demands a test.

## Related Issues

- `route-file-missing-auth-middleware-goes-undetected-until-new-feature-needs-req-user.md`
- `fix-branches-orphaned-across-sessions.md`
- Issues #151, #153; PRs #152, #156, #195, #196, #186
