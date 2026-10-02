# Usage/quota threshold warnings — correction and final implementation

**Date:** 2026-09-19, corrected same day after Navin pushed back.

## What was asked

A hook that warns/stops the session on approaching 80% of the 5-hour
session limit or the weekly quota.

## First pass: wrong conclusion

Checked the documented hook input schemas (SessionStart, PreToolUse,
PostToolUse, etc.) and found no rate-limit fields on any of them, and
concluded no mechanism exists. **This was incomplete** — it never checked
the `statusLine` command's own stdin schema, which is a different input
shape from the hook events. Navin correctly pointed out the status line
already displays *some* usage data, which was the actual clue this session
missed.

## Corrected finding

The `statusLine` command (configured via the `statusLine` setting) receives
JSON on stdin that DOES include real rate-limit data, exclusive to that one
event — no other hook receives it:

- `rate_limits.five_hour.used_percentage` (0-100)
- `rate_limits.five_hour.resets_at` (Unix epoch seconds)
- `rate_limits.seven_day.used_percentage` (0-100) — the weekly quota
- `rate_limits.seven_day.resets_at` (Unix epoch seconds)

These fields are populated for Pro/Max/Teams/Enterprise plans after the
session's first API response; requires a recent Claude Code version.

## What was actually built (global, `~/.claude/`, not this repo —
applies to every Claude Code session on the machine, per Navin's choice)

1. **`~/.claude/statusline-command.sh`** (existing script, extended, not
   replaced): now shows `5h <used%> (reset Xh Ym)` and `7d <used%> (reset
   Xd Yh)` segments, color-coded green/yellow/red at 50%/80% thresholds,
   alongside the model/context/cost segments it already had.

2. **Cache handoff, since only `statusLine` sees this data**: the script
   writes the latest reading to `~/.claude/rate-limit-cache.json` on every
   render (best-effort, never breaks the status line if the write fails).

3. **`~/.claude/hooks/usage-threshold-warning.js`** (new, `UserPromptSubmit`
   hook): reads that cache file (not the rate-limit data directly — it has
   no access to it) and, if either window is ≥80% and the cached reading
   is fresh (≤30 min old), **hard-blocks the prompt** (`decision: "block"`)
   rather than just warning — per Navin's explicit follow-up instruction
   ("only if i say go ahead u do so"). Behavior:
   - Over threshold, prompt has no affirmative phrase ("go ahead",
     "proceed", "continue anyway", etc.) → blocked, prompt never reaches
     Claude, reason shown to the user.
   - Over threshold, prompt IS an affirmative phrase → allowed, and that
     session is marked acknowledged in `~/.claude/rate-limit-ack-state.json`
     so it isn't blocked again for the rest of that session (a one-time
     gate per crossing, not a block on every single prompt while over
     threshold — that would make the session unusable).
   - A different/new session at the same usage level is blocked again
     independently (acknowledgment is keyed by `session_id`).
   - Fails open (never blocks) on a missing/stale cache or any read
     error — a bug in this hook must never be able to lock the user out.

Both pieces pipe-tested directly before being wired into
`~/.claude/settings.json`: synthetic stdin JSON for the statusline script;
and, for the hook, all four real code paths — block on a fresh crossing,
unlock on an affirmative prompt, quiet pass-through once acknowledged in
that session, and re-block for a different session_id at the same
crossing.

## Lesson

When told "no mechanism exists," check whether a *different* event/command
in the same tool has a different, undocumented-in-the-obvious-place input
schema before concluding a capability doesn't exist — `statusLine` and the
`hooks` object are configured side by side in the same settings file but
receive structurally different stdin payloads, and this session only
checked one of the two.
