#!/usr/bin/env bash
# Kills the Android emulator and its child processes ourselves, after the Maestro result is
# recorded. reactivecircus/android-emulator-runner#385: its "Terminate Emulator" teardown
# waits on the whole emulator process tree (e.g. crashpad_handler) and hangs to the step cap
# (~10 min per shard measured). Killing the tree first lets the action's teardown find nothing.
# Never fails and never changes the caller's exit code: every command is best-effort.
# Usage: bash ../scripts/kill-emulator-android.sh   (env: ADB_BIN, PKILL_BIN, SLEEP_BIN)
set -u
ADB_BIN="${ADB_BIN:-adb}"
PKILL_BIN="${PKILL_BIN:-pkill}"
SLEEP_BIN="${SLEEP_BIN:-sleep}"
"$ADB_BIN" emu kill || true
"$SLEEP_BIN" 3 || true
"$PKILL_BIN" -f crashpad_handler || true
"$PKILL_BIN" -f qemu-system || true
"$SLEEP_BIN" 2 || true
echo "kill-emulator-android: emulator kill attempted"
exit 0
