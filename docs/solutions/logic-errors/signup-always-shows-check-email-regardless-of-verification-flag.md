---
title: "Signup always routed to CheckEmailScreen, even when email verification wasn't required"
date: 2026-08-16
category: docs/solutions/logic-errors
module: frontend/src/screens/LoginScreen.tsx, frontend/src/context/AuthContext.tsx, backend/src/controllers/authController.ts
problem_type: logic_error
component: authentication
symptoms:
  - "Every new signup landed on \"check your email to verify your account\" even when REQUIRE_EMAIL_VERIFICATION=false on the live backend and no email would ever arrive (SendGrid not configured)"
  - "User confusion: signup appeared to succeed but then stalled on a dead-end screen with no way forward"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [signup, email-verification, onboarding, auth-flow]
---

# Signup always routed to CheckEmailScreen, even when email verification wasn't required

## Problem

`REQUIRE_EMAIL_VERIFICATION` (see `docs/solutions/build-errors/render-eas-free-tier-deploy-setup.md`'s sibling deploy context) is `false` on the live Render deployment, and the backend's login check already respects it correctly: `backend/src/controllers/authController.ts:178` only blocks login when `isEmailVerificationRequired() && !user.emailVerified`. But `frontend/src/screens/LoginScreen.tsx`'s `handleSignup` unconditionally navigated every successful signup to `CheckEmailScreen`, regardless of whether verification was actually required — the frontend never checked the flag at all.

## Symptoms

- A brand-new user signing up on the live app was sent to a screen instructing them to check their email
- No email would ever arrive (SendGrid isn't configured on this deployment), so the user had no way to proceed from that screen without already knowing (from someone else) that they could just log in directly
- Confirmed via direct query against the live Neon DB (`emailVerified: false`, `password: set`) that at least one real user was stuck in exactly this state despite already having a fully working account

## What Didn't Work

N/A — root-caused directly by reading `LoginScreen.tsx`'s `handleSignup` and cross-checking it against the backend's actual login gate, once the live `REQUIRE_EMAIL_VERIFICATION` value was confirmed via the Render API to rule out a backend/config explanation.

## Solution

- `backend/src/controllers/authController.ts`: the signup response now includes `requireEmailVerification: boolean`, computed via the same `isEmailVerificationRequired()` helper the login gate already uses — no new endpoint needed.
- `frontend/src/context/AuthContext.tsx`: `signup()` now mirrors `login()` — when `requireEmailVerification` is `false`, it stores the token/user and flips `isAuthenticated` immediately, rather than leaving the user unauthenticated pending email confirmation.
- `frontend/src/screens/LoginScreen.tsx`: `handleSignup` only navigates to `CheckEmailScreen` when `requireEmailVerification` is `true`; otherwise it relies on `App.tsx`'s existing `isAuthenticated` routing effect (the same mechanism used after a normal login) to route straight into the app.

## Why This Works

The backend already had the correct, single source of truth for whether verification blocks anything (`isEmailVerificationRequired()`). The bug was that the frontend had its own separate, hardcoded assumption ("always show check-email after signup") that never consulted it. Threading the same flag through the signup response makes the frontend's post-signup routing consistent with what the backend will actually enforce at the next login attempt, instead of assuming the strictest case unconditionally.

## Prevention

- Added test coverage for both branches (verification required vs not) in `backend/src/__tests__/auth/signup.test.ts`, `frontend/src/context/__tests__/AuthContext.test.tsx`, and `frontend/src/screens/__tests__/LoginScreen.test.tsx` (split into two cases).
- When a backend feature flag gates behavior (like `REQUIRE_EMAIL_VERIFICATION`), check every frontend code path that assumes a fixed outcome of that flag — a flag correctly respected in one place (login) does not guarantee it's respected everywhere a related assumption is hardcoded (post-signup navigation).
