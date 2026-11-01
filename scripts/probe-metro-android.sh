#!/usr/bin/env bash
# Verifies the Android emulator can reach Metro at 10.0.2.2:8081 BEFORE any Maestro flow
# runs. Without this, a dead host link shows the "Unable to load script" redbox and every
# flow fails at `email-input is visible`. Method: HTTP GET /status from inside the emulator
# via curl; emulator images without curl fall back to toybox `nc` (present on all Android
# images) sending a raw HTTP request. Polls (re-running `adb reverse`) instead of one fixed wait.
# Env: ADB_BIN, SLEEP_BIN, TIMEOUT_BIN (default: timeout if installed, else none), PROBE_ATTEMPTS (6), PROBE_SLEEP_SECS (5), DIAG_CURL_BIN (curl).
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
# Best-effort failure diagnostics: separates "Metro down on host" from "emulator route dead".
# Every command is wrapped; failure/timeout only prints a note. Never alters the exit code.
CURL_BIN="${DIAG_CURL_BIN:-curl}"
diag_t() { if [ -n "$TIMEOUT_BIN" ]; then "$TIMEOUT_BIN" "$ADB_TIMEOUT" "$@"; else "$@"; fi; }
diag_run() {
  local title="$1"; shift
  echo "probe-diag: == $title =="
  diag_t "$@" < /dev/null 2>&1 || echo "probe-diag: (command failed or timed out: $title)"
}
diag_all() {
  diag_run "host: metro /status" "$CURL_BIN" -sf -m5 http://localhost:8081/status
  echo "probe-diag: == host: listeners on 8081 =="
  { ss -ltnp 2>/dev/null || netstat -ltn 2>/dev/null; } | grep 8081 || echo "probe-diag: (no listener found or ss/netstat unavailable)"
  echo "probe-diag: == host: metro.log (last 40 lines) =="
  tail -n 40 "${GITHUB_WORKSPACE:-.}/metro.log" 2>&1 || echo "probe-diag: (metro.log not available)"
  diag_run "emulator: adb devices" "$ADB_BIN" devices
  diag_run "emulator: adb reverse --list" "$ADB_BIN" reverse --list
  diag_run "emulator: sys.boot_completed" "$ADB_BIN" shell getprop sys.boot_completed
  echo "probe-diag: == emulator: ip route =="
  { diag_t "$ADB_BIN" shell ip route < /dev/null 2>&1 | head -5; } || echo "probe-diag: (ip route failed)"
  echo "probe-diag: == emulator: ping 10.0.2.2 =="
  { diag_t "$ADB_BIN" shell "ping -c1 -W2 10.0.2.2" < /dev/null 2>&1 | tail -2; } || echo "probe-diag: (ping failed)"
}
diag_all || :
echo "::error::cold-start: emulator cannot reach Metro at 10.0.2.2:8081 after $ATTEMPTS attempts"
exit 1
