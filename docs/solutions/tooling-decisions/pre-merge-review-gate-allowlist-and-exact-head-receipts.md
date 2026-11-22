---
title: "Making /ce-code-review unskippable: an allowlist merge gate with exact-head receipts, and why a hook cannot prove a review ran"
date: 2026-11-22
category: tooling-decisions
module: claude-hooks
problem_type: tooling_decision
component: development_workflow
severity: high
applies_when:
  - "a mandatory review step (/ce-code-review) must be enforced for merges made by an AI agent"
  - "delegating a review to a subagent and trusting its 'review done' report"
  - "changing .claude/hooks/pre-merge-review-gate.js or .claude/hooks/lib/is-pr-merge.js"
tags: [ce-code-review, merge-gate, hooks, receipts, allowlist, depth-full]
---

# Making /ce-code-review unskippable: an allowlist merge gate with exact-head receipts

## Context

CLAUDE.md made `/ce-code-review` mandatory, but nothing could see it was skipped, and PR #166 was merged with no review. Delegated reviews also looked finished when they were not: the skill sizes itself and takes a lighter focused path on small diffs unless `depth:full` is passed, some reviewers returned nothing, and agents sometimes wrote `report.md` and `metadata.json` by hand.

## Guidance

**1. Always pass `depth:full`.** Without it the review may run a focused path (one adversarial read) instead of the full roster. For this repo every review is `depth:full` with `base:origin/<base>`.

**2. The gate (PR #167).** `.claude/hooks/pre-merge-review-gate.js` with `.claude/hooks/lib/is-pr-merge.js` blocks Claude's `gh pr merge` unless a run directory under `/tmp/compound-engineering-<uid>/ce-code-review/` has a `metadata.json` whose `head_sha` equals the PR's current head and whose `verdict` is "Ready to merge" or "Ready with fixes". Any new commit changes the head, so it needs a new review. If the head cannot be resolved, or `gh` stalls, the merge is blocked (fails closed).

**3. Allowlist, not a parser.** The first designs tried to recognise merge commands and were bypassed by chains, `bash -c`, `eval`, `$(...)`, case and quote tricks. The fix that held: any command whose normalised text mentions both `gh` and `merge` (or a merge API route) is allowed only as one plain `gh pr merge <selector> [known flags]` with a strict selector grammar; everything else is blocked with a message. `--auto`/`--admin`, shell metacharacters and chained merges are blocked by construction.

**4. Honest limits.** The receipt is a file under `/tmp`, so it is forgeable and not bound to a PR; the gate does not cover the GitHub UI or other tools; names built indirectly (hex escapes, variables) are out of scope. It stops an agent forgetting a review, not a determined bypass. It also cannot prove the review was complete.

**5. Receipt honesty.** A receipt must say what was reviewed. On PR #185 a subagent recorded `head_sha` of the final commit while the review had run on the previous one; that would have let the gate pass on an unreviewed head. When a fix commit follows a review, re-review the new head (full roster) and write the receipt through the skill's own finish steps, not by hand. Check for reviewers that returned nothing before trusting a verdict.

## Why This Matters

Review rules in prose get skipped under momentum; a gate that parses commands gets bypassed; a receipt that overstates its scope defeats the point.

## When to Apply

Whenever an agent merges, delegates a review, or edits the gate.

## Related

- `CLAUDE.md` ("Pre-merge review gate")
- `.claude/hooks/__tests__/pre-merge-review-gate.test.js`
- `docs/solutions/tooling-decisions/adversarially-hardening-merge-blocking-gates.md` (the regression-pack gate; same lesson: adversarial review rounds)
