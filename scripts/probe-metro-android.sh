#!/usr/bin/env bash
# Verifies the Android emulator can reach Metro at 10.0.2.2:8081 BEFORE any Maestro flow
# runs. Without this, a dead host link shows the "Unable to load script" redbox and every
# flow fails at `email-input is visible`. Method: HTTP GET /status from inside the emulator
# via curl; emulator images without curl fall back to toybox `nc` (present on all Android
# images) sending a raw HTTP request. Polls (re-running `adb reverse`) instead of one fixed wait.
# Env: ADB_BIN, SLEEP_BIN, TIMEOUT_BIN (default: timeout if installed, else none), PROBE_ATTEMPTS (6), PROBE_SLEEP_SECS (5).
set -u
ADB_BIN="${ADB_BIN:-adb}"
SLEEP_BIN="${SLEEP_BIN:-sleep}"
if [ -z "${TIMEOUT_BIN+x}" ]; then TIMEOUT_BIN="$(command -v timeout || true)"; fi
ADB_TIMEOUT="${PROBE_ADB_TIMEOUT:-20}"
adb_t() { if [ -n "$TIMEOUT_BIN" ]; then "$TIMEOUT_BIN" "$ADB_TIMEOUT" "$ADB_BIN" "$@"; else "$ADB_BIN" "$@"; fi; }
ATTEMPTS="${PROBE_ATTEMPTS:-6}"
PAUSE="${PROBE_SLEEP_SECS:-5}"
probe_once() {
  local out
  out="$(adb_t shell "curl -sf -m5 http://10.0.2.2:8081/status" < /dev/null 2>&1 || true)"
  case "$out" in *"not found"*|*"No such file"*)
    out="$(adb_t shell "printf 'GET /status HTTP/1.0\r\n\r\n' | nc -w5 10.0.2.2 8081" < /dev/null 2>&1 || true)" ;;
  esac
  case "$out" in *packager-status:running*) return 0 ;; esac
  return 1
}
for i in $(seq 1 "$ATTEMPTS"); do
  if probe_once; then echo "probe-metro-android: Metro reachable from emulator (attempt $i)"; exit 0; fi
  echo "probe-metro-android: attempt $i/$ATTEMPTS failed; re-running adb reverse"
  adb_t reverse tcp:8081 tcp:8081 < /dev/null || :
  [ "$i" -lt "$ATTEMPTS" ] && "$SLEEP_BIN" "$PAUSE"
done
echo "::error::cold-start: emulator cannot reach Metro at 10.0.2.2:8081 after $ATTEMPTS attempts"
exit 1
