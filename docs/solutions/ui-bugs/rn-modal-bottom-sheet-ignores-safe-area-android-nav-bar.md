---
title: RN Modal bottom-sheet pickers ignore SafeAreaView insets, so the Android nav bar covers rows
date: 2026-09-26
category: docs/solutions/ui-bugs
module: frontend
problem_type: ui_bug
component: tooling
symptoms:
  - "Who Paid? picker: the Android 3-button system navigation bar is drawn over the 2nd member's row, so members past the first cannot be selected"
  - "Home group list: the last card's Edit Group link is cut off by the same nav bar"
  - "Does not reproduce in a desktop browser or via adb taps on an emulator without the 3-button nav bar"
root_cause: scope_issue
resolution_type: code_fix
severity: high
tags: [react-native, modal, safe-area, android, nav-bar, maestro, regression-test, issue-45]
---

# RN Modal bottom-sheet pickers ignore SafeAreaView insets, so the Android nav bar covers rows

## Problem

Issue #45 ("Paid by field cannot select 2nd payer and so on") was a real device bug: on Android with the 3-button navigation bar, bottom-sheet pickers rendered their last rows underneath the system nav bar. The fix shipped as PR #82 and was confirmed working on the owner's phone on 2026-09-26.

## Symptoms

- Owner's screenshot: the "Who Paid?" modal on Edit Expense with the square/circle/triangle nav icons drawn over the 2nd member's row.
- A second screenshot: the Home "Expense Groups" list with the last card's "Edit Group" link cut off by the same bar.
- 13 desktop-browser Playwright cases and initial `adb` tap runs could not reproduce it.

## What Didn't Work

- **Desktop browser and plain emulator taps.** They have no system nav bar overlay, so every payer was selectable. Hours went into varying viewports and member counts.
- **The LogBox theory.** On a `development`-profile EAS build, React Native's "Open debugger to view warnings" banner really does cover a middle row of the same modal (found via `maestro hierarchy` bounds). It is a genuine but different mechanism. The owner's phone runs the `preview` profile, which has no dev client, so it was not what they saw. Confirming which build profile the reporter actually runs would have ruled it out sooner.
- **No screenshot on the issue.** The issue body was one line. The real cause was found only after the owner sent two device screenshots.
- **A structural-only first regression test.** The first test only asserted that the picker used `SafeAreaView`. Its first behavioral version still false-passed on master for the two EditExpense modals, because jsdom renders `Modal` inline and the screen-root `SafeAreaView` matched. It only became a real guard after adding a check that the wrapper is the modal's own `SafeAreaView`, not the screen root.

## Solution

React Native's `Modal` renders in a separate native layer and does not inherit the parent screen's `SafeAreaView` insets. Wrap each bottom-sheet modal's content in its own `SafeAreaView` from `react-native-safe-area-context`, and give screens with no safe-area root one. Shipped in PR #82:

- Modal wrappers: `TypeAheadDropdown.tsx` (`frontend/src/components/TypeAheadDropdown.tsx:138`), and the Who Paid?/Split Type modals in `EditExpenseScreen.tsx` (line 463 for Split Type). `CreateExpenseScreen.tsx`'s four modals got the same wrapper.
- Screen roots with no safe-area container: `HomeScreen`, `ExpenseListScreen`, `SettlementScreen`, `CreateExpenseScreen`.
- `EditExpenseScreen` already wrapped its screen root (line 373); only its modals were missing the wrapper.

## Why This Works

A `Modal` is not a child of the screen's view tree on the native side, so the screen's `SafeAreaView` padding never applies to it. Wrapping the modal content in its own `SafeAreaView` makes the modal apply the device's bottom inset itself.

## Prevention

- **Test at the right level.** A jsdom test cannot compute real insets. The regression test (`frontend/src/__tests__/regression/issue-45-picker-modal-nav-bar-overlap.test.tsx`) mocks `react-native-safe-area-context` with a 48px bottom inset and asserts the modal's own wrapper applies it. It fails 7 of 7 without the fix. Always assert that the wrapper is the modal-level one, not the screen root.
- **Pair it with a visual baseline.** `maestro-flows/visual/payer-picker-modal-safe-area.yaml` plus its `.png` scored 92.6% (below the 95% threshold) on pre-fix code and passes on the fix, but only on the local emulator. In CI it fails, because it needs an `e2e-paidby45-group` fixture that CI does not seed (see below).
- **Any new bottom-sheet `Modal` should wrap its content in `SafeAreaView`**, matching the existing `DatePickerModal` pattern.
- **Confirm the reporter's build profile and get a screenshot before theorising.** `frontend/eas.json` has `development`, `preview` and `production` profiles; only `development` sets `developmentClient: true`.

## Related Issues

- Related CI finding, fixed in PR #84: `e2e-mobile` login failures were caused by an emulator "Pixel Launcher isn't responding" ANR dialog covering the login screen. The fix added `adb shell settings put global hide_error_dialogs 1` to the emulator script in `.github/workflows/ci.yml`.
- Still open in PR #85 (unmerged as of this writing): the Maestro visual baselines assume fixtures that CI does not seed (a 3-member group, an 8-member `e2e-paidby45-group`, a July 2026 expense date), and the 3-attempt retry loop exceeds the 18-minute step cap. The owner should not treat `e2e-mobile` as a valid gate until that lands.
- `docs/solutions/build-errors/dependabot-expo-sdk-drift-and-debug-build-needs-metro.md` covers a different debug-build failure mode.
