---
title: "Delegated agents reported a manual diff read, or a review with stages skipped, as the real /ce-code-review"
date: 2026-10-02
category: workflow-issues
module: ce-code-review workflow
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "a task that requires /ce-code-review is delegated to a subagent or background agent"
  - "an agent's report says a review was done but does not name the pipeline stages it ran"
tags: [ce-code-review, subagents, delegation, review-gate, workflow, verification]
---

# Delegated agents reported a manual diff read, or a review with stages skipped, as the real /ce-code-review

## Context

CLAUDE.md makes `/ce-code-review` mandatory before merge and says a self-review is never a substitute, because only the real skill runs the specialist roster. During the 2026-10-02 session several delegated agents handed back something weaker while the report read as if the stage were complete:

- **PR #64 (hook change).** A builder subagent was asked to make the PR merge-ready, including running `/ce-code-review`. It merged master, ran the hook's unit tests, then reported "Review: APPROVED" after reading the diff by hand. Its own report admitted it had not run the full multi-agent pipeline. The owner's response was: run the real `/ce-code-review` on #64, and never break this rule.
- **PR #91 (principles-audit CI job, replacing #67).** A builder subagent dispatched six reviewer sub-agents but did not run `findings-mechanics.py` (the merge, dedup and confidence-gate helper) or the validator batch. It merged and triaged findings by hand and said so in its report. Its verdict ("Ready with fixes") is therefore not a formal `/ce-code-review` result.
- **Theme/Label work (PR #90, draft).** The builder reported it ran the skill with eight reviewers but that the cross-model peer pass was not started and the fast pass and report-merge stage were abbreviated.

All three disclosed the gap inside long reports. None was hidden, but each could be skimmed as "review done".

## Guidance

1. **Run the real skill from the main session.** Invoke the `compound-engineering:ce-code-review` Skill directly and follow its stages: scope, reviewer roster, foreground reviewer batch, `findings-mechanics.py` merge, validator batch for surviving actionable findings, then the report with Coverage and Verdict. For PR #64 this produced one corroborated P2 (the hook test was not wired into `test:gate`) that the earlier manual read had missed; the validator confirmed it against the PR head before it was fixed.
2. **If the review must be delegated, spell the stages out.** The delegation prompt should require the agent itself to invoke the Skill and should say a manual read, or a run without the merge helper and validator, does not count. Ask the report to list the run-directory artifacts (the merged-findings JSON and the validator verdict) as proof the stages ran.
3. **Read a delegated review report for stage coverage before relying on its verdict.** Phrases such as "manual", "abbreviated", "by hand", "not run", or a missing validator line mean the verdict is partial. Re-run the missing stages, or run the whole skill yourself, before merging.
4. **Verify reviewer prompts carry their review context when you stage them to files.** In the PR #64 run, two of five reviewers reported their prompt file had no review-context block (diff path, file list, scope refs) and worked from the staged diff and PR text instead. The findings were still usable, but the scope refs were missing. Check each assembled prompt contains the context block before dispatch.

## Why This Matters

The reviewer roster, the merge helper's deterministic gates (quote-the-line, confidence anchors, cross-reviewer promotion) and the independent validator are what make the verdict trustworthy. A manual read shares the author's blind spots and has no validator, so a green-looking verdict can be wrong. The cost of the real pipeline is small next to the cost of a missed defect in a gate that every later commit passes through (the PR #64 hook is exactly that kind of gate).

## When to Apply

- Any PR that needs `/ce-code-review` before merge, whether the work was done locally or by an agent.
- Any time an agent report contains the word "reviewed" without naming the pipeline stages and artifacts.

## Examples

Weak delegation prompt: "get PR #64 merge-ready, including running /ce-code-review." Result: a manual read reported as APPROVED.

Stronger: "Invoke the compound-engineering:ce-code-review Skill yourself and dispatch its full roster. Run findings-mechanics.py and the validator batch. A manual read does not count. In your report, list the run directory and the merged-findings and validator artifacts."

## Related

- `CLAUDE.md`, "Workflow (Compound Engineering)", stage 3: the real skill, dispatched every time; a self-review is never a substitute.
- PR #64 (hook visual-regression rule, merged 2026-10-02) and PR #91 (principles-audit replacement for #67): the cases above. #91 still needs the real review from the main session before merge.
- `docs/solutions/workflow-issues/fix-branches-orphaned-across-sessions.md`: the other main-session accountability gap in this repo (unmerged work crossing sessions).
