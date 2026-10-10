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
MAX_ATTEMPTS=2

failed=0
: > "$OUT/visual-result.txt"
echo "### Maestro visual flows (BLOCKING - assertScreenshot at 95% threshold)" >> "$OUT/visual-result.txt"

for f in "$SRC"/*.yaml; do
  name="$(basename "$f" .yaml)"
  ok=1
  status=0
  log="$OUT/${name}.log"
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    timeout "$FLOW_TIMEOUT" maestro test "$f" 2>&1 | tee "$log"
    status=${PIPESTATUS[0]}
    if [ "$status" -eq 0 ]; then
      ok=0
      break
    fi
    echo "Flow $name failed on attempt $attempt (exit $status)"
  done
  if [ "$ok" -eq 0 ]; then
    echo "- [Passed] $name" >> "$OUT/visual-result.txt"
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
done

cat "$OUT/visual-result.txt"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$OUT/visual-result.txt" >> "$GITHUB_STEP_SUMMARY"; fi

echo "Visual flows failed: $failed"
[ "$failed" -eq 0 ]
