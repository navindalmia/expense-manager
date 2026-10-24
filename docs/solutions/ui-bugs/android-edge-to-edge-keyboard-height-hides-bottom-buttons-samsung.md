---
title: Create Group Cancel/Create row hidden under the Samsung 3-button nav bar; KeyboardAvoidingView 'height' breaks edge-to-edge Android
date: 2026-10-24
category: docs/solutions/ui-bugs
module: frontend
problem_type: ui_bug
component: tooling
symptoms:
  - "Create Group: the Cancel/Create row is partly under the Android system navigation buttons on load, and fully hidden after typing in the fields above"
  - "Only on a Samsung Galaxy A55 (SM-A556B, Android 16, 3-button navigation); fine on a phone with gesture navigation"
  - "Still present on a staging build that already contained the ScreenContainer safe-area fix (#118/#119)"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [react-native, expo, edge-to-edge, keyboard-avoiding-view, safe-area, android, samsung, nav-bar, device-diagnostics, issue-138, issue-139]
---

# Create Group Cancel/Create row hidden under the Samsung 3-button nav bar; KeyboardAvoidingView 'height' breaks edge-to-edge Android

## Problem

On the owner's Samsung Galaxy A55 the bottom Cancel/Create row of Create Group could not be reached: partly under the three system buttons on load, completely hidden after typing. The CI emulator and a second phone looked correct, so no automated check saw it. It took three fixes; only the third found the cause.

## Symptoms

- The action row is drawn under the system navigation buttons (3-button mode) and cannot be tapped in full.
- It worsens after the keyboard has been opened and closed on the form.
- Reproduces on a build that already used the shared `ScreenContainer` (safe-area bottom edge).

## What Didn't Work

- **"The safe-area inset is 0 on Samsung."** A web search turned up Samsung/Xiaomi reports of unreliable insets on Expo SDK 53+, so #135 added a 48dp spacer in `ScreenContainer` when Android reports an inset of 0. No effect: a staging-only device card (`DeviceDiagnostics`, #136) showed the A55 reports a correct bottom inset of `48` and window size equals screen size (`frontend/src/components/DeviceDiagnostics.tsx:52`). The spacer never rendered.
- **Padding on Create Group only.** Rejected: the same bug class lives on every screen that hand-rolls keyboard handling, and per-screen patches were how half of them got forgotten (#111 had fixed some screens, not others).
- **Guessing from a cropped photo.** One photo could not tell "clipped by the nav bar" from "cropped screenshot"; a full-screen photo plus the device card was what moved the investigation.

## Solution

1. **`KeyboardAwareScroll` (#138)** is the one scrolling-form body: `KeyboardAvoidingView` with `'padding'` on iOS and no behavior on Android, then `KeyboardInsetView`, the focused-input scroll helper and `keyboardShouldPersistTaps="handled"` (`frontend/src/components/KeyboardAwareScroll.tsx:41-47`, helpers in `frontend/src/hooks/useKeyboardInset.tsx:75` and `frontend/src/hooks/useKeyboardInset.tsx:95`). Create Group, Create Expense, Edit Expense, Login, Verify Email and Check Email use it.
2. **`FORM_BOTTOM_CLEARANCE = 64` (#139)** (`KeyboardAwareScroll.tsx:26`): a `paddingBottom` floor under the last control inside the shared scroller (a screen's larger padding wins). The first fix left the row slightly covered; owner confirmed the button is fine after the 64dp floor reached the phone as an over-the-air update.
3. **Guard test** `frontend/src/__tests__/regression/issue-138-keyboard-standard.test.ts` (lines 32-44) fails any screen that imports `KeyboardAvoidingView`/`KeyboardInsetView` directly, sets `behavior='height'` anywhere in `src`, or drops `KeyboardAwareScroll` from the six form screens. It was red on the pre-change tree.

## Why This Works

`KeyboardAvoidingView behavior='height'` assumes the window resizes for the keyboard. On edge-to-edge Android (`android.edgeToEdgeEnabled`, Android 15/16) it does not, so the computed height is wrong and the whole layout stays offset by about the nav-bar height, and it does not reset cleanly when the keyboard closes. That offset equals the 3-button bar height, which is why a gesture-navigation phone barely shows it. `KeyboardInsetView` pads by the real overlap between keyboard top and container bottom instead of guessing, and the 64dp floor keeps the last row scrollable clear of the system buttons regardless of how a device reports its bars.

## Prevention

- **One shared module, enforced by a source-level test**, not per-screen fixes; add new form screens through `KeyboardAwareScroll`.
- **When a layout bug is one-phone-only and the CI emulator cannot reproduce it, ship a staging-only diagnostics card** (model, API level, insets, window vs screen) and ask for a full-screen photo before changing layout code. Measure before the third guess.
- **Do not trust a zero-inset theory without measuring**: the inset here was correct.
- The Samsung nav-bar mode cannot be reproduced on the CI emulator; the guard test and unit tests are the regression net, with device confirmation by the owner.

## Related Issues

- Adjacent doc, same symptom family but a different mechanism (Modal outside the screen `SafeAreaView`): `docs/solutions/ui-bugs/rn-modal-bottom-sheet-ignores-safe-area-android-nav-bar.md` (#45/#82).
- Over-the-air delivery of the fix to installed staging builds: `docs/solutions/tooling-decisions/eas-update-ota-for-android-preview-distribution.md` (that doc covers the preview channel; staging launch-wait and the About "Check for update" button are #137).
- PRs: #111 (hand-applied keyboard hook), #118/#119 (`ScreenContainer`), #135 (spacer, ineffective), #136 (diagnostics), #137 (staging OTA), #138 (shared scroller + guard), #139 (64dp floor). This doc: #140.
