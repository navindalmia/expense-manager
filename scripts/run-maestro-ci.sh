#!/usr/bin/env bash
# Runs the Maestro flows for the e2e-mobile CI job. Called from ci.yml with cwd=frontend/.
# BLOCKING: every flow in maestro-flows/visual/ (including its `assertScreenshot`
# step) against the baselines committed there. Each flow is retried individually
# (max MAX_ATTEMPTS attempts) to absorb cold-launch latency on the CI emulator -
# only failed flows re-run. The job fails if any flow still fails after its
# retries, INCLUDING an assertScreenshot mismatch at the existing 95% threshold.
# Baselines (maestro-flows/visual/*.png) were regenerated from this same CI
# emulator/renderer (see docs/solutions and PR #85) so the threshold is
# meaningful here, unlike the earlier local-Mac-emulator baselines.
# pipefail: `maestro test | tee` must report maestro's exit code, not tee's
# (without it a failed flow was silently counted as passed).
set -u -o pipefail
# Each attempt is bounded so one hung flow (a known flaky one is
# payer-picker-modal-safe-area: the emulator sometimes hangs on its launch)
# cannot eat the whole job; later flows still run and artifacts still upload.
FLOW_TIMEOUT="${FLOW_TIMEOUT:-240}"
SRC="${MAESTRO_FLOWS_DIR:-../maestro-flows/visual}"
OUT="${GITHUB_WORKSPACE:-..}"
MAX_ATTEMPTS=3
# Emulator race (run 38151243425): `launchApp clearState` can have its NEW process
# killed by a late remove-task timeout. Before every attempt we reset the app
# ourselves and let the emulator settle. Binaries/delays are env-configurable for tests.
ADB_BIN="${ADB_BIN:-adb}"
SLEEP_BIN="${SLEEP_BIN:-sleep}"
APP_ID="${MAESTRO_APP_ID:-com.navindalmia.expensemanager}"
SETTLE_SECS="${SETTLE_SECS:-4}"
RETRY_SETTLE_SECS="${RETRY_SETTLE_SECS:-10}"
reset_app() {
  "$ADB_BIN" shell am force-stop "$APP_ID" < /dev/null || :
  "$ADB_BIN" shell pm clear "$APP_ID" < /dev/null || :
  "$ADB_BIN" shell input keyevent KEYCODE_HOME < /dev/null || :
  "$SLEEP_BIN" "$SETTLE_SECS"
}
# Retry only infrastructure/app-launch failures; never screenshot or other assertion failures.
is_retryable() { # $1=exit status $2=log
  if grep -qE 'Comparison error|assertScreenshot|screenshot' "$2"; then return 1; fi
  [ "$1" -eq 124 ] && return 0
  grep -qE 'Unable to launch app|email-input is visible' "$2"
}
# Quarantine list: lines of `<flow-name>  #<issue>  <reason>`. A quarantined flow
# still RUNS, but its failure does not fail the job; it is reported loudly, and a
# quarantined flow that passes prints a hint to remove it. Missing/empty = strict.
QUARANTINE_FILE="${MAESTRO_QUARANTINE_FILE:-$SRC/../quarantine.txt}"
quarantine_issue() {
  [ -f "$QUARANTINE_FILE" ] || return 1
  awk -v n="$1" '$1 !~ /^#/ && $1 == n { i = $2; sub(/^#/, "", i); print (i == "" ? "?" : i); found=1; exit } END { exit !found }' "$QUARANTINE_FILE"
}

failed=0
flaky=0
planned=0
executed=0
: > "$OUT/visual-result.txt"
echo "### Maestro visual flows (BLOCKING - assertScreenshot at 95% threshold)" >> "$OUT/visual-result.txt"

# Sharding: MAESTRO_SHARD (1-based) of MAESTRO_SHARD_COUNT picks this job's
# flows via scripts/maestro-shards.js; unset runs every flow.
if [ -n "${MAESTRO_SHARD:-}" ]; then
  FLOW_FILES="$(node "$(dirname "$0")/maestro-shards.js" list "$MAESTRO_SHARD" "${MAESTRO_SHARD_COUNT:?}" "$SRC")"
  echo "Shard $MAESTRO_SHARD/$MAESTRO_SHARD_COUNT flows:"; echo "$FLOW_FILES"
else
  FLOW_FILES="$(ls "$SRC"/*.yaml)"
fi

while IFS= read -r f; do
  [ -n "$f" ] || continue
  planned=$((planned + 1))
  # Test hook: simulate a loop that stops early (guards the planned==executed check).
  if [ -n "${MAESTRO_TEST_SKIP_AFTER:-}" ] && [ "$executed" -ge "$MAESTRO_TEST_SKIP_AFTER" ]; then continue; fi
  executed=$((executed + 1))
  name="$(basename "$f" .yaml)"
  ok=1
  status=0
  log="$OUT/${name}.log"
  passed_attempt=0
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    reset_app
    timeout "$FLOW_TIMEOUT" maestro test "$f" < /dev/null 2>&1 | tee "$log"
    status=${PIPESTATUS[0]}
    if [ "$status" -eq 0 ]; then
      ok=0
      passed_attempt=$attempt
      break
    fi
    echo "Flow $name failed on attempt $attempt (exit $status)"
    if ! is_retryable "$status" "$log"; then
      echo "Flow $name failure is not a launch/infrastructure failure; not retrying"
      break
    fi
    [ "$attempt" -lt "$MAX_ATTEMPTS" ] && "$SLEEP_BIN" "$RETRY_SETTLE_SECS"
  done
  qissue="$(quarantine_issue "$name" || true)"
  if [ "$ok" -eq 0 ] && [ -n "$qissue" ]; then
    echo "- [Passed] $name" >> "$OUT/visual-result.txt"
    echo "- QUARANTINED FLOW NOW PASSING - remove it from the list: $name (issue #$qissue)" >> "$OUT/visual-result.txt"
  elif [ "$ok" -eq 0 ] && [ "$passed_attempt" -gt 1 ]; then
    flaky=$((flaky + 1))
    echo "- FLAKY (passed on attempt $passed_attempt) $name" >> "$OUT/visual-result.txt"
  elif [ "$ok" -eq 0 ]; then
    echo "- [Passed] $name" >> "$OUT/visual-result.txt"
  elif [ -n "$qissue" ]; then
    detail=$(grep -m1 -E 'Comparison error|Assertion is false' "$log" || true)
    echo "- QUARANTINED (known failing, issue #$qissue): $name failed (exit $status) ($detail)" >> "$OUT/visual-result.txt"
  else
    failed=$((failed + 1))
    detail=$(grep -m1 -E 'Comparison error|Assertion is false' "$log" || true)
    if [ "$status" -eq 124 ]; then
      echo "- [Timeout] $name (exceeded ${FLOW_TIMEOUT}s per attempt; known flaky: payer-picker-modal-safe-area)" >> "$OUT/visual-result.txt"
    else
      echo "- [Failed] $name ($detail)" >> "$OUT/visual-result.txt"
    fi
    echo "VISUAL FAIL: $name" | tee -a "$OUT/visual-failures.txt"
  fi
done <<< "$FLOW_FILES"

echo "Flaky flows: $flaky" >> "$OUT/visual-result.txt"
echo "Flows planned: $planned, executed: $executed" >> "$OUT/visual-result.txt"
if [ "$executed" -lt "$planned" ] || [ "$planned" -eq 0 ]; then
  failed=$((failed + 1))
  echo "- [Failed] runner executed fewer flows than planned ($executed/$planned)" >> "$OUT/visual-result.txt"
fi
cat "$OUT/visual-result.txt"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$OUT/visual-result.txt" >> "$GITHUB_STEP_SUMMARY"; fi

echo "Visual flows failed: $failed"
[ "$failed" -eq 0 ]
