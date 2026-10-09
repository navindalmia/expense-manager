---
title: Re-validating an unchanged per-user theme/label id on every expense update blocks other group members from saving
date: 2026-10-04
category: docs/solutions/logic-errors
module: expenses
problem_type: logic_error
component: service_object
symptoms:
  - "A group member editing an expense created by someone else gets 404 THEME_NOT_FOUND or LABEL_NOT_FOUND on save without touching the theme or label"
  - "An expense whose theme or label was later disabled can no longer be saved after editing an unrelated field"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [expenses, themes, labels, per-user-data, authorization, group-members, update-semantics]
---

# Re-validating an unchanged per-user theme/label id on every expense update blocks other group members from saving

## Problem

Themes and labels are per-user rows (an owner `userId`, or `null` for a global row), and an expense stores a single `themeId` / `labelId` scalar. In PR #90, `updateExpense` ran the visibility check (`assertThemeVisible` / `assertLabelVisible`, later with `requireActive`) on whatever `themeId` / `labelId` the request carried. The edit form resubmits the expense's existing ids on every save. So any save by a user who does not own that theme or label, or any save after the owner disabled it, was rejected even though the user changed nothing about the theme or label.

## Symptoms

- Member B edits the amount of Member A's expense in a shared group and the save fails with 404 `THEME_NOT_FOUND` / `LABEL_NOT_FOUND`.
- Disabling a theme made every expense that already used it un-editable.

## What Didn't Work

The first fix attempt ("grandfathering") only relaxed the `isActive` part: `requireActive` was set to `themeId !== expense.themeId`. That handled the disabled-theme case but still ran the ownership check on the unchanged id, so other group members still got a 404. It was caught by the adversarial reviewer in the re-review of the fix delta (confidence 50, rated P2), not by the first review or by the unit tests, which only exercised a single user.

## Solution

On update, validate the relation only when the id actually changes; otherwise skip the lookup entirely. On create, keep full validation with `requireActive: true`.

```ts
if (themeId === null) {
  updateData.theme = { disconnect: true };
} else if (themeId !== undefined) {
  // Only validate when the theme changes
  if (themeId !== expense.themeId) {
    await assertThemeVisible(userId, themeId, { requireActive: true });
  }
  updateData.theme = { connect: { id: themeId } };
}
```

The same shape is applied to `labelId`. Shipped in PR #90 (pushed to the PR branch; the PR was still open and unmerged as of 2026-10-04, so the fix is not on master yet). Changing to an id that is disabled, or that belongs to another user, is still rejected.

## Why This Works

The danger the check guards against is attaching a relation the user is not allowed to use. An id that equals the expense's current value is not a new attachment, so it needs no new authorization decision. Skipping it also makes the update idempotent for the edit form's resubmit-everything behavior.

## Prevention

- For any "validate the related record on update" check, compare against the stored value first and validate only on change.
- When relations can be owned per user but records are shared (expenses in a group), test the update path as a second, non-owning user. The regression file `backend/src/__tests__/regression/issue-90-unchanged-theme-label-not-revalidated.test.ts` (on the PR #90 branch) covers: unchanged id owned by another user succeeds with no lookup; changed id to a disabled or foreign theme/label is rejected. The "owned by another user" case failed before the fix.
- Treat a form that resubmits every field as a normal client, not an edge case.

## Related Issues

- `docs/solutions/logic-errors/group-soft-delete-leaves-expense-titles-in-autocomplete-pool.md` (same family: soft-deleted or per-user rows leaking through shared read/write paths)
