---
title: "Mount-only theme fetch in an always-mounted modal left the Edit Group theme picker stale"
date: 2026-10-09
category: docs/solutions/logic-errors
module: EditGroupModal / HomeScreen
problem_type: logic_error
component: frontend_stimulus
symptoms:
  - A theme created later (for example on the expense screen) never appeared in the Edit Group theme picker until the app was restarted
  - The expense screen, which refetches on every open, showed the new theme while Edit Group did not
root_cause: async_timing
resolution_type: code_fix
severity: medium
tags: [react-native, useeffect, stale-data, always-mounted-modal, race-condition, themes, regression-test, maestro-visual]
---

# Mount-only theme fetch in an always-mounted modal left the Edit Group theme picker stale

## Problem

`HomeScreen` renders `EditGroupModal` for the whole session and only toggles `visible` (`frontend/src/screens/HomeScreen.tsx:496`). The modal loaded its theme list in a mount-only effect (`useEffect(() => { getThemes().then(setThemes)... }, [])`, pre-fix; issue #93). Because the component never unmounted, that fetch ran once at app start. Any theme created afterwards was missing from the Edit Group theme picker until the app was restarted.

## Symptoms

- A theme ("Liverpool") created on the expense screen showed up in that screen's theme list but not in Edit Group's theme picker. (Observed on a PR #90 build: the expense-level theme picker is added by PR #90, still open, and is not on master.)
- That expense screen loads themes in `useExpenseData`, whose effect depends on `[expenseId, groupId]` (PR #90 head, `useExpenseData.ts:51-109`), so it refetches each time the screen mounts. Edit Group fetched once per app session, so the two screens disagreed about the same user's themes.
- Restarting the app made the theme appear. No error was logged.
- The backend was correct. The DB row was active and owned by the logged-in user, and `listThemes` returns active themes where `userId` is null or the caller (`backend/src/services/themeService.ts:12-20`).

## What Didn't Work

- **Suspecting per-user scoping.** Themes are per-user, so a theme owned by a different account legitimately does not show. Rule this out first by querying `Theme` by owner. Here the owner matched the logged-in user, so scoping was not the cause.
- **Suspecting a disabled theme.** `listThemes` filters `isActive: true`, so an inactive theme is hidden by design. The row was active.
- What cracked it was comparing the two screens' fetch timing: one fetches each time the screen mounts, the other once per app session.

## Solution

Before (`EditGroupModal.tsx`, mount-only fetch):

```tsx
// Fetch themes from database on component mount
useEffect(() => {
  getThemes()
    .then(setThemes)
    .catch((error) => logger.error('Failed to load themes', error));
}, []);
```

After (`frontend/src/components/EditGroupModal.tsx:177-190`, PR #94):

```tsx
useEffect(() => {
  if (!visible) return;
  let cancelled = false;
  getThemes()
    .then((fetched) => {
      if (!cancelled) setThemes(fetched);
    })
    .catch((error) => logger.error('Failed to load themes', error));
  return () => {
    cancelled = true;
  };
}, [visible]);
```

## Why This Works

- The `[visible]` dependency re-runs the effect on every open, so the list reflects the server at the moment the user looks at it.
- `if (!visible) return;` avoids a pointless fetch while the modal is hidden and on first render.
- `cancelled` plus the cleanup guards against out-of-order responses. If the user opens, closes and reopens quickly, the first request's cleanup runs when `visible` flips, so a late reply from the earlier open cannot overwrite the newer list.

## Prevention

- **Audit pattern.** Any modal or sheet that `HomeScreen` keeps mounted must not load data in a mount-only effect (`useEffect(..., [])` containing a service call). Grep the components rendered by `HomeScreen` for it. Checked against master's `frontend/src/components`: `AddMemberModal` has only a timer-cleanup mount effect (`AddMemberModal.tsx:189-195`), and `CurrencyPicker` fetches on mount with deps `[attempt]` (`CurrencyPicker.tsx:39`). Currencies change rarely, so that one was left alone, but it is the same shape if that assumption changes.
- **Regression test** (`frontend/src/__tests__/regression/issue-93-edit-group-theme-list-stale.test.tsx`). Red-before-green was verified, including removing the `cancelled` flag to watch the stale-response test fail.
- **Model server state with a mutable variable, not `mockResolvedValueOnce`.** `Once` values get consumed by a different call than intended. The first version of this test also asserted a fetch while hidden, which the fix deliberately no longer does.

```tsx
let serverThemes: Theme[] = [{ id: 1, name: 'Monthly Expense', userId: null, isActive: true }];
mockGetThemes.mockImplementation(() => Promise.resolve(serverThemes));
const { rerender } = render(<EditGroupModal visible={false} group={null} {...handlers} />);
serverThemes = [...serverThemes, { id: 20, name: 'Liverpool', userId: 1, isActive: true }];
rerender(<EditGroupModal visible group={group} {...handlers} />);
// open picker, expect 'Liverpool' to be rendered
```

- **Fetch count:** assert no `getThemes` call while hidden and exactly one per open (`toHaveBeenCalledTimes(1)`, then `2` after a close and reopen).
- **Stale response:** hold the first call's promise open, close and reopen, resolve the first promise after the second open, then assert the fresh theme is shown and the stale one is not.

```tsx
mockGetThemes
  .mockImplementationOnce(() => new Promise<Theme[]>((r) => { resolveFirst = r; }))
  .mockImplementationOnce(() => Promise.resolve(fresh));
// visible -> hidden -> visible, then:
resolveFirst(stale);
expect(screen.queryByText('Stale Theme')).toBeNull();
```

- **Visual baseline.** `maestro-flows/visual/edit-group-theme-picker-screen.yaml` and its `.png` pin how the opened picker looks. The `.png` came from the CI emulator's `maestro-debug-output` artifact, per the repo convention.
- **Diagnosis checklist for "item missing from a list":** (1) query the DB by owner to rule out per-user scoping, (2) check `isActive`, (3) compare when each screen fetches. Only then suspect the backend.

## Related Issues

- Issue #93 (closed) and PR #94 (merged), the fix. PR #90 (open) is where the per-user theme feature came from.
- `docs/solutions/logic-errors/hydration-effect-runs-reset-after-populating-real-values.md` is another `useEffect` lifecycle bug on a different screen. It shares the effect-timing theme only.
- `docs/solutions/logic-errors/revalidating-unchanged-per-user-theme-id-on-update-404s-other-group-members.md` covers the backend side of per-user themes.
- `docs/solutions/developer-experience/testing-on-a-real-phone-against-a-local-backend.md` is the manual route by which this was noticed.
