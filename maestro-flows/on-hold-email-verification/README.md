# On hold: email-verification Maestro suite

**Status: on hold, 2026-08-31 — do not wire into CI, do not treat as active coverage.**

These 12 flows (8 test cases + 4 shared helpers) test the email-verification UX:
signup → "check your email" screen → deep-link token verification → login blocked
until verified → resend → invalid-token handling.

**Why on hold:** `REQUIRE_EMAIL_VERIFICATION=false` is the app's current live
configuration (Render production and local `.env.local` both set it, since
2026-08-16 — see `PROJECT_MEMORY/01-MASTER_STATE.md`). With verification off,
signup auto-authenticates immediately and none of the screens these flows
assert on (`CheckEmailScreen`, the "Resend" button, verify-success/error
screens) ever render. Running the suite against the app's actual current
behavior fails 10 of 13 sub-flows — not because the flows are broken, but
because they test a code path that's intentionally unreachable right now.

**Verified 2026-08-31:** ran the full suite against a live Android emulator +
local backend. `LoginFlow` and `GlobalSetup` passed (not verification-specific).
`SignupFlow` and all 8 TC flows failed on missing verification-only UI.

**Before reactivating:** either (a) force `REQUIRE_EMAIL_VERIFICATION=true`
specifically for the test/CI environment so this UI exists to assert against,
or (b) rewrite these flows around the app's actual current signup UX
(auto-authenticate, no check-email step) — a real product/testing decision,
not a mechanical fix. Neither has been decided; this is parked, not fixed.
