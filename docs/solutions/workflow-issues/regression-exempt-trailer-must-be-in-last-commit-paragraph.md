---
title: "Regression-Exempt must be in the last paragraph of the commit message or the CI regression-gate ignores it"
date: 2026-10-09
category: docs/solutions/workflow-issues
module: scripts/regression-gate.js
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "a PR or commit with a fix( subject adds no new issue-N regression test and needs a Regression-Exempt trailer"
  - "the commit message also ends with a Co-Authored-By trailer or any other trailer"
  - "CI regression-gate fails with 'PR contains a fix commit but adds no qualifying regression test' although the trailer is present"
tags: [regression-gate, commit-trailers, ci, git, co-authored-by, pull-request]
---

# Regression-Exempt must be in the last paragraph of the commit message or the CI regression-gate ignores it

## Context

PR #96 was a `fix(hooks):` PR that deliberately had no `issue-N` regression test (its coverage is `.claude/hooks/__tests__/hook-config.test.js`). Its commit messages carried `Regression-Exempt: <reason>`, but the CI `regression-gate` job still failed with "PR contains a fix commit but adds no qualifying regression test ... or add a trailer line Regression-Exempt".

## Guidance

Git trailers are the `Key: value` lines of the **last paragraph** of the message, and `scripts/regression-gate.js` follows that exactly: `parseTrailers` reads only the last paragraph and `hasExemption` looks for `regression-exempt` there (`scripts/regression-gate.js:61-72`; the header at line 27 says exemptions are "real trailers (last paragraph of the message)"). The commit had a blank line between `Regression-Exempt:` and `Co-Authored-By:`, so the exemption sat in the second-to-last paragraph and was ignored.

Put every trailer together in the final paragraph, with no blank line between them:

```
fix(hooks): subject

Body paragraphs ...

Regression-Exempt: <reason>
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Why This Matters

The exemption is scoped per commit and read by CI and the local `.githooks/commit-msg`; a mis-placed trailer fails the required `regression-gate` check late, after the PR is open, and the only fix is to rewrite the commit message (here: squash to one commit and `git push --force-with-lease` on the unmerged PR branch).

## When to Apply

Any commit that needs `Regression-Exempt:` and also carries a `Co-Authored-By:` line (or any other trailer). The other exemption trailers (`Test-Exempt:`, `E2E-Exempt:`, `Visual-Regression-Exempt:`) are read by `.claude/hooks/pre-commit-quality-gate.js`, which matches them anywhere in the `-m` message (lines 144-146), so the last-paragraph rule is specific to `Regression-Exempt` (CI `regression-gate` and the local git hooks).

## Examples

Check a message before pushing, using the repo's own function:

```bash
node -e "const g=require('./scripts/regression-gate.js'); const m=require('child_process').execSync('git log -1 --format=%B').toString(); console.log(g.hasExemption(m))"
```

`true` means the gate will see it.

## Related

- PR #96. `docs/solutions/integration-issues/hook-matcher-with-permission-pattern-never-matches-tool-name.md`.
- `docs/solutions/tooling-decisions/visual-regression-hook-uses-exempt-trailer-not-hard-block.md`
