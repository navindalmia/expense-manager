---
title: Create Group buttons hidden under Samsung 3-button nav bar; KeyboardAvoidingView 'height' breaks edge-to-edge Android
date: 2026-10-24
category: docs/solutions/runtime-errors
module: frontend
problem_type: runtime_error
component: react-native-layout
severity: medium
applies_when:
  - "A bottom action row (Create/Save/Cancel) is partly or fully under the Android system navigation buttons on one phone but not another"
  - "A screen still wraps its form in KeyboardAvoidingView with behavior 'height' on Android"
  - "The app runs edge-to-edge (android.edgeToEdgeEnabled) on Android 15/16"
tags: [react-native, expo, edge-to-edge, keyboard, safe-area, samsung, navigation-bar, eas-update]
---

## Problem

On a Samsung Galaxy A55 (SM-A556B, Android 16, 3-button navigation) the Cancel/Create row of Create Group sat under the system buttons, partly on load and fully after typing. It looked fine on a phone with gesture navigation. Staging build 29881003 already had the #119 SafeAreaView fix.

## What it was NOT (wasted two fixes)

- Not a zero safe-area inset. A staging-only device card on About showed the Samsung reports the correct bottom inset (48), window == screen. A "reserve 48dp when the inset is 0" spacer in ScreenContainer (#135) therefore did nothing.
- Not Create-Group-specific padding. A per-screen tweak was rejected: the same bug class lives on every screen that hand-rolls keyboard handling.

## Root cause

`KeyboardAvoidingView behavior='height'` on Android cannot work on edge-to-edge Android: the window does not resize for the IME, so it computes the wrong height and leaves the layout offset by roughly the nav-bar height, and it does not reset cleanly when the keyboard closes. #111 had introduced the right pattern (KeyboardInsetView + scroll-into-view helper) but only on some screens, by hand. Create Group, Login, Verify Email and Check Email still used 'height'.

## Fix (what finally worked)

1. `components/KeyboardAwareScroll` (#138): the one scrolling-form body (KAV padding on iOS / none on Android, KeyboardInsetView, focused-input helper, keyboardShouldPersistTaps="handled"); all six form screens migrated. `issue-138-keyboard-standard.test.ts` fails any screen that imports KeyboardAvoidingView/KeyboardInsetView directly or sets behavior='height' anywhere.
2. Guaranteed space under the last control (#139): `FORM_BOTTOM_CLEARANCE = 64` paddingBottom floor inside KeyboardAwareScroll. Confirmed fixed on the Samsung after the over-the-air update.

## How it was diagnosed (reuse)

When a layout bug only shows on one phone and CI cannot reproduce it, ship a staging-only diagnostics card (device model, API level, insets, window vs screen size - `DeviceDiagnostics` on About) and ask for a photo instead of guessing again.

## Process lessons

- Fix it once in a shared module plus a source-level guard test; do not patch screen by screen.
- Staging builds installed by link: Android builds on the Expo Free plan are capped monthly (hit 2026-10-24, resets 2026-11-01). JS-only fixes still reach installed staging builds through EAS Update; staging builds wait up to 5s for an update at launch and About has a "Check for update" button (#137). Native config changes need a new APK.
