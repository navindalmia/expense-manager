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
set -u
SRC="../maestro-flows/visual"
OUT="${GITHUB_WORKSPACE:-..}"
MAX_ATTEMPTS=2

failed=0
: > "$OUT/visual-result.txt"
echo "### Maestro visual flows (BLOCKING - assertScreenshot at 95% threshold)" >> "$OUT/visual-result.txt"

for f in "$SRC"/*.yaml; do
  name="$(basename "$f" .yaml)"
  ok=1
  log="$OUT/${name}.log"
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    if maestro test "$f" 2>&1 | tee "$log"; then
      ok=0
      break
    fi
    echo "Flow $name failed on attempt $attempt"
  done
  if [ "$ok" -eq 0 ]; then
    echo "- [Passed] $name" >> "$OUT/visual-result.txt"
  else
    failed=$((failed + 1))
    detail=$(grep -m1 -E 'Comparison error|Assertion is false' "$log" || true)
    echo "- [Failed] $name ($detail)" >> "$OUT/visual-result.txt"
    echo "VISUAL FAIL: $name" | tee -a "$OUT/visual-failures.txt"
  fi
done

cat "$OUT/visual-result.txt"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$OUT/visual-result.txt" >> "$GITHUB_STEP_SUMMARY"; fi

echo "Visual flows failed: $failed"
[ "$failed" -eq 0 ]
