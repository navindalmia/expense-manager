#!/usr/bin/env bash
# Runs the Maestro flows for the e2e-mobile CI job. Called from ci.yml with cwd=frontend/.
#  1. FUNCTIONAL pass (blocking): every flow in maestro-flows/visual/ with its
#     `assertScreenshot` step stripped, so only behaviour is verified. Each flow
#     is retried individually (max 2 attempts) - only failed flows re-run.
#  2. VISUAL pass (non-blocking): the unmodified flows, run once, with the
#     per-flow similarity results written to visual-result.txt and the job summary.
# Exit code = functional result only.
set -u
SRC="../maestro-flows/visual"
FUNC_DIR="$(mktemp -d)"
OUT="${GITHUB_WORKSPACE:-..}"
MAX_ATTEMPTS=2

for f in "$SRC"/*.yaml; do
  grep -v '^- assertScreenshot' "$f" > "$FUNC_DIR/$(basename "$f")"
done

failed=0
for f in "$FUNC_DIR"/*.yaml; do
  ok=1
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    if maestro test "$f"; then ok=0; break; fi
    echo "Functional flow $(basename "$f") failed on attempt $attempt"
  done
  if [ "$ok" -ne 0 ]; then
    failed=$((failed + 1))
    echo "FUNCTIONAL FAIL: $(basename "$f")" | tee -a "$OUT/functional-failures.txt"
  fi
done

# Visual pass: never affects the exit code (baselines were recorded on a different emulator).
maestro test "$SRC" 2>&1 | tee "$OUT/visual-raw.txt" || true
{
  echo "### Maestro visual flows (NON-BLOCKING - baselines need CI-emulator regeneration)"
  grep -E '^\[(Passed|Failed)\]' "$OUT/visual-raw.txt" | sed 's/^/- /'
} > "$OUT/visual-result.txt"
cat "$OUT/visual-result.txt"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$OUT/visual-result.txt" >> "$GITHUB_STEP_SUMMARY"; fi

echo "Functional flows failed: $failed"
[ "$failed" -eq 0 ]
