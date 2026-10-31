'use strict';

// Guards the emulator teardown workaround (android-emulator-runner#385): the script must
// kill the emulator and its children, and must never fail or alter the caller's exit code.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'kill-emulator-android.sh');

function run(failing) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kill-emu-'));
  const log = path.join(dir, 'calls.log');
  const fake = (name, rc) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, `#!/usr/bin/env bash\necho "${name} $*" >> "${log}"\nexit ${rc}\n`, { mode: 0o755 });
    return p;
  };
  const rc = failing ? 1 : 0;
  const res = spawnSync('bash', [SCRIPT], {
    env: { ...process.env, ADB_BIN: fake('adb', rc), PKILL_BIN: fake('pkill', rc), SLEEP_BIN: fake('sleep', 0) },
    encoding: 'utf8',
  });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
  return { res, calls };
}

test('should call adb emu kill and pkill for crashpad_handler and qemu-system', () => {
  const { res, calls } = run(false);
  assert.equal(res.status, 0);
  assert.ok(calls.includes('adb emu kill'));
  assert.ok(calls.includes('pkill -f crashpad_handler'));
  assert.ok(calls.includes('pkill -f qemu-system'));
});

test('should exit 0 even when adb and pkill both fail', () => {
  const { res, calls } = run(true);
  assert.equal(res.status, 0);
  assert.equal(calls.filter((c) => c.startsWith('pkill')).length, 2);
});

test('should wait with a bounded sleep between kill and pkill', () => {
  const { calls } = run(false);
  const sleeps = calls.filter((c) => c.startsWith('sleep'));
  assert.ok(sleeps.length >= 1);
  for (const s of sleeps) assert.ok(Number(s.split(' ')[1]) <= 10);
});
