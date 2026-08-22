---
title: "Maestro flow tapped non-touchable static text instead of the real link, failing several steps later with no obvious cause"
date: 2026-08-22
category: docs/solutions/test-failures
module: maestro-flows
problem_type: test_failure
component: testing_framework
severity: medium
symptoms:
  - "`maestro test` reported `Tap on \"Don't have account?\"... COMPLETED` with no error, but a later step (tapping the `name-input` field) failed with `Element with Id matching regex: name-input not found`"
  - "The failure appeared at a step several actions after the actual point of breakage, with no indication in the log or error message that the earlier tap hadn't done what was intended"
root_cause: logic_error
resolution_type: test_fix
tags: [maestro, e2e-testing, react-native, touch-target, false-positive]
---

# Maestro flow tapped non-touchable static text instead of the real link, failing several steps later with no obvious cause

## Problem

`shared-signup-flow.yaml`'s first step, `tapOn: text: "Don't have account?"`, was meant to switch `LoginScreen.tsx` from login mode into signup mode. Maestro found and tapped that text and reported `COMPLETED`, but the app never actually changed mode — because that text isn't the real tappable element.

`frontend/src/screens/LoginScreen.tsx:440-457` renders the toggle as two sibling elements, not one:

```tsx
<View style={styles.toggleContainer}>
  <Text style={styles.toggleText}>
    {isSignupMode ? 'Already have account?' : "Don't have account?"}
  </Text>
  <TouchableOpacity onPress={() => { setIsSignupMode(!isSignupMode); ... }}>
    <Text style={styles.toggleLink}>
      {isSignupMode ? 'Login' : 'Signup'}
    </Text>
  </TouchableOpacity>
</View>
```

The static prefix ("Don't have account?") is a plain `<Text>` with no `onPress` — only the short link word ("Signup") is wrapped in the actual `TouchableOpacity`. Maestro's `tapOn: text:` matched the static text's on-screen bounds (it did find real, visible text) and tapped its center — which doesn't overlap the real touch target.

## Symptoms

- `maestro test` output showed `Tap on "Don't have account?"... COMPLETED`, `Wait for animation to end... COMPLETED`, then failed several steps later on `Tap on id: name-input` with `Element with Id matching regex: name-input not found`
- The `name-input` field only renders when `isSignupMode` is `true` — so the real failure (mode never switched) happened at the very first step, but nothing in the log said so

## What Didn't Work

Reading the error message and Maestro's suggested "possible causes" list alone was insufficient — they pointed at `name-input` as the broken selector, which was actually correct and unrelated to the real problem.

## Solution

Captured and read the actual screenshot Maestro saves to `~/.maestro/tests/<run-timestamp>/<flow-name>/screenshots/step-NNN-...png` at the point just before the failing step. It showed the screen still in **Login mode** ("Welcome Back", a "Login" submit button, "Don't have account? Signup" still visible) — proof the toggle tap never took effect, despite Maestro reporting it `COMPLETED`.

Fixed by targeting the actual link word directly:

```yaml
# Before
- tapOn:
    text: "Don't have account?"

# After
- tapOn:
    text: "Signup"
```

Applied the same fix to `shared-login-flow.yaml` (`"Already have account?"` → `"Login"`). Re-ran `tc1-signup.yaml` live against a real emulator with a real built APK; the flow now progresses correctly through the toggle, into the signup form, filling `name-input`/`email-input`/`password-input`, and submitting.

## Why This Works

Maestro's `tapOn: text:` matches on-screen text and taps the center of *that text's own bounding box* — it has no awareness of which element in the React tree actually owns the `onPress` handler. When a UI splits a prompt into "static label + short link," as is common for accessibility and layout reasons, any selector targeting the label instead of the link will find real text, report success, and still miss the real touch target. Maestro's `COMPLETED` status only confirms "an element matching this text was found and tapped" — it is not a confirmation that the tap produced the intended effect.

## Prevention

- When a `tapOn` step's target is a *phrase* rather than a short, obviously-clickable word ("Login", "Submit", "Cancel"), check the component source for whether the whole phrase or only part of it is the real touch target, before trusting the selector.
- **A `COMPLETED` status on a tap does not verify the tap worked** — pair a state-changing tap with an assertion that the expected post-tap state is actually visible (e.g., assert the signup form's `name-input` appears) before proceeding to the next unrelated step, so a false-positive tap fails immediately at its real point of breakage rather than several steps later.
- When a flow fails at a step whose precondition should obviously already be true (an element that "should" exist by then), pull the actual screenshot from `~/.maestro/tests/<run>/.../screenshots/` for the step just before the failure — the error message alone described the wrong root cause here.
