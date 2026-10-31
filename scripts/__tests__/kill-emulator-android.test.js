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

// --- pipe-holder cleanup ---
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kill-emu-px-'));
  const proc = path.join(dir, 'proc');
  const log = path.join(dir, 'calls.log');
  const addProc = (pid, ppid, out, err, cmd) => {
    const d = path.join(proc, String(pid));
    fs.mkdirSync(path.join(d, 'fd'), { recursive: true });
    fs.writeFileSync(path.join(d, 'stat'), `${pid} (x y) S ${ppid} 1 1 0\n`);
    fs.writeFileSync(path.join(d, 'cmdline'), `${cmd}\0--flag\0`);
    fs.symlinkSync(out, path.join(d, 'fd', '1'));
    fs.symlinkSync(err, path.join(d, 'fd', '2'));
  };
  const fake = (name, rc) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, `#!/usr/bin/env bash\necho "${name} $*" >> "${log}"\nexit ${rc}\n`, { mode: 0o755 });
    return p;
  };
  return { dir, proc, log, addProc, fake };
}

function runPx(f, rc, procDir) {
  const res = spawnSync('bash', [SCRIPT], {
    env: {
      ...process.env,
      ADB_BIN: f.fake('adb', rc), PKILL_BIN: f.fake('pkill', rc), SLEEP_BIN: f.fake('sleep', 0),
      PS_BIN: f.fake('ps', rc), KILL_BIN: f.fake('kill', rc), PROC_DIR: procDir, SELF_PID: '100',
    },
    encoding: 'utf8',
  });
  const calls = fs.existsSync(f.log) ? fs.readFileSync(f.log, 'utf8').split('\n').filter(Boolean) : [];
  return { res, calls };
}

function populated() {
  const f = fixture();
  f.addProc(100, 50, 'pipe:[111]', 'pipe:[222]', 'self');
  f.addProc(50, 10, 'pipe:[111]', 'pipe:[222]', 'ancestor');
  f.addProc(10, 1, 'pipe:[111]', 'pipe:[222]', 'grandparent');
  f.addProc(200, 1, 'pipe:[111]', '/dev/null', 'metro');
  f.addProc(201, 1, '/dev/null', 'pipe:[222]', 'crashpad');
  f.addProc(300, 1, 'pipe:[999]', 'pipe:[998]', 'unrelated');
  return f;
}

test('should kill holders of the same pipe but not unrelated pids or the ancestor chain', () => {
  const f = populated();
  const { res, calls } = runPx(f, 0, f.proc);
  assert.equal(res.status, 0);
  const kills = calls.filter((c) => c.startsWith('kill'));
  for (const pid of ['200', '201']) {
    assert.ok(kills.includes(`kill -TERM ${pid}`));
    assert.ok(kills.includes(`kill -KILL ${pid}`));
  }
  for (const pid of ['100', '50', '10', '300']) assert.ok(!kills.some((k) => k.endsWith(` ${pid}`)));
  assert.match(res.stdout, /pipe-holder: pid=200 ppid=1 cmd=metro --flag/);
  assert.match(res.stdout, /pipe-holders remaining after kill:/);
});

test('should invoke adb kill-server as the last external call', () => {
  const f = populated();
  const { calls } = runPx(f, 0, f.proc);
  assert.equal(calls[calls.length - 1], 'adb kill-server');
});

test('should exit 0 when kill, ps and adb all fail', () => {
  const f = populated();
  const { res } = runPx(f, 1, f.proc);
  assert.equal(res.status, 0);
});

test('should exit 0 and note the skip when PROC_DIR is missing', () => {
  const f = fixture();
  const { res, calls } = runPx(f, 0, path.join(f.dir, 'nope'));
  assert.equal(res.status, 0);
  assert.match(res.stdout, /missing, skipping pipe-holder scan/);
  assert.ok(!calls.some((c) => c.startsWith('kill ')));
});
