#!/usr/bin/env bash
# Kills the Android emulator and its child processes ourselves, after the Maestro result is
# recorded. reactivecircus/android-emulator-runner#385: its "Terminate Emulator" teardown
# waits on the whole emulator process tree (e.g. crashpad_handler) and hangs to the step cap
# (~10 min per shard measured). Killing the tree first lets the action's teardown find nothing.
# Never fails and never changes the caller's exit code: every command is best-effort.
# After the kills it also dumps the process table, names and kills any process still holding this
# script'"'"'s stdout/stderr pipe (a leftover holder keeps the CI step open), then stops the adb server.
# Usage: bash ../scripts/kill-emulator-android.sh
# Env: ADB_BIN, PKILL_BIN, SLEEP_BIN, PS_BIN, KILL_BIN, PROC_DIR, SELF_PID (all injectable for tests)
set -u
ADB_BIN="${ADB_BIN:-adb}"
PKILL_BIN="${PKILL_BIN:-pkill}"
SLEEP_BIN="${SLEEP_BIN:-sleep}"
PS_BIN="${PS_BIN:-ps}"
KILL_BIN="${KILL_BIN:-kill}"
PROC_DIR="${PROC_DIR:-/proc}"
SELF_PID="${SELF_PID:-$$}"
"$ADB_BIN" emu kill || true
"$SLEEP_BIN" 3 || true
"$PKILL_BIN" -f crashpad_handler || true
"$PKILL_BIN" -f qemu-system || true
"$SLEEP_BIN" 2 || true
echo "kill-emulator-android: emulator kill attempted"

# --- diagnostics and pipe-holder cleanup (best-effort, every failure ignored) ---
echo "--- process table (first 80 lines) ---"
{ "$PS_BIN" -eo pid,ppid,pgid,stat,etime,args 2>&1 | head -n 80; } || true

ppid_of() { sed -e 's/^.*) //' "$PROC_DIR/$1/stat" 2>/dev/null | awk '{print $2}'; }
cmd_of() { { tr '\0' ' ' < "$PROC_DIR/$1/cmdline" 2>/dev/null; } || true; }

# Prints pids (excluding self and ancestors) sharing this script's stdout/stderr pipe.
find_holders() {
  local out err pid p1 p2 skip a n
  out="$(readlink "$PROC_DIR/$SELF_PID/fd/1" 2>/dev/null)" || out=""
  err="$(readlink "$PROC_DIR/$SELF_PID/fd/2" 2>/dev/null)" || err=""
  skip=" $SELF_PID "
  a="$SELF_PID"; n=0
  while [ -n "$a" ] && [ "$a" -gt 1 ] 2>/dev/null && [ "$n" -lt 64 ]; do
    a="$(ppid_of "$a")"; skip="$skip$a "; n=$((n + 1))
  done
  for d in "$PROC_DIR"/[0-9]*; do
    pid="${d##*/}"
    case "$skip" in *" $pid "*) continue ;; esac
    p1="$(readlink "$d/fd/1" 2>/dev/null)" || p1=""
    p2="$(readlink "$d/fd/2" 2>/dev/null)" || p2=""
    if { [ -n "$out" ] && { [ "$p1" = "$out" ] || [ "$p2" = "$out" ]; }; } ||
       { [ -n "$err" ] && { [ "$p1" = "$err" ] || [ "$p2" = "$err" ]; }; }; then
      echo "$pid"
    fi
  done
}

report_holders() {
  local pid
  for pid in "$@"; do
    echo "pipe-holder: pid=$pid ppid=$(ppid_of "$pid") cmd=$(cmd_of "$pid")"
  done
}

if [ -d "$PROC_DIR" ]; then
  HOLDERS="$(find_holders 2>/dev/null)" || HOLDERS=""
  # shellcheck disable=SC2086
  report_holders $HOLDERS
  if [ -n "$HOLDERS" ]; then
    for pid in $HOLDERS; do "$KILL_BIN" -TERM "$pid" || true; done
    "$SLEEP_BIN" 2 || true
    for pid in $HOLDERS; do
      if [ -d "$PROC_DIR/$pid" ]; then "$KILL_BIN" -KILL "$pid" || true; fi
    done
    echo "killed pipe-holders: $(echo $HOLDERS)"
  fi
else
  echo "kill-emulator-android: $PROC_DIR missing, skipping pipe-holder scan"
fi

"$ADB_BIN" kill-server || true

if [ -d "$PROC_DIR" ]; then
  REMAINING="$(find_holders 2>/dev/null | tr '\n' ' ')" || REMAINING=""
  echo "pipe-holders remaining after kill: ${REMAINING:-none}"
fi
exit 0
