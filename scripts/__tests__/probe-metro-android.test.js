'use strict';

// Guards the Metro reachability probe and the is_retryable rule in run-maestro-ci.sh.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROBE = path.resolve(__dirname, '..', 'probe-metro-android.sh');
const RUNNER = path.resolve(__dirname, '..', 'run-maestro-ci.sh');

function probe(okOnShellCall) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));
  const adb = path.join(dir, 'adb');
  // `shell` calls succeed only from the okOnShellCall-th call onward (0 = never).
  fs.writeFileSync(adb, `#!/usr/bin/env bash\necho "adb $*" >> "${dir}/calls.log"\nif [ "$1" = shell ]; then k=$(cat "${dir}/n" 2>/dev/null || echo 0); k=$((k+1)); echo $k > "${dir}/n"; if [ ${okOnShellCall} -gt 0 ] && [ $k -ge ${okOnShellCall} ]; then echo packager-status:running; fi; fi\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'fakesleep'), '#!/usr/bin/env bash\n', { mode: 0o755 });
  const res = spawnSync('bash', [PROBE], {
    env: { ...process.env, ADB_BIN: adb, SLEEP_BIN: path.join(dir, 'fakesleep'), PROBE_ATTEMPTS: '4' },
    encoding: 'utf8',
  });
  const calls = fs.readFileSync(path.join(dir, 'calls.log'), 'utf8');
  return { res, calls };
}

test('probe passes on the first attempt without re-running adb reverse', () => {
  const { res, calls } = probe(1);
  assert.equal(res.status, 0);
  assert.doesNotMatch(calls, /reverse/);
});

test('probe passes after a retry and re-runs adb reverse', () => {
  const { res, calls } = probe(3);
  assert.equal(res.status, 0);
  assert.match(calls, /adb reverse tcp:8081 tcp:8081/);
});

test('probe fails with a cold-start message after exhausting attempts', () => {
  const { res, calls } = probe(0);
  assert.notEqual(res.status, 0);
  assert.match(res.stdout, /cold-start: emulator cannot reach Metro/);
  assert.equal((calls.match(/reverse tcp:8081/g) || []).length, 4);
  assert.equal((calls.match(/adb shell curl/g) || []).length, 4, 'one probe per attempt');
});

function retryable(log, status) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retry-'));
  const f = path.join(dir, 'log.txt');
  fs.writeFileSync(f, log);
  const fn = spawnSync('bash', ['-c', `src="$(sed -n '/^is_retryable()/,/^}/p' "${RUNNER}")"; [ -n "$src" ] || exit 99; eval "$src"; is_retryable ${status} "${f}"`]);
  assert.notEqual(fn.status, 99, 'is_retryable function text must be extracted');
  return fn.status === 0;
}

test('is_retryable is true for email-input failure even with the Debug output (logs & screenshots) header', () => {
  assert.equal(retryable('Assertion is false: id: email-input is visible\n==== Debug output (logs & screenshots) ====\n', 1), true);
});

test('is_retryable is false for a real screenshot Comparison error', () => {
  assert.equal(retryable('Assertion is false: screenshot Comparison error: 90%\n==== Debug output (logs & screenshots) ====\n', 1), false);
});

const HEADER = '==== Debug output (logs & screenshots) ====\n';
// Captured verbatim from CI run 40574113460 (e2e-mobile-shard 2/4, login-screen).
const REAL_CMP = 'Assert screenshot matches login-screen (threshold: 95%)... FAILED\n' +
  'Comparison error: Assert screenshot matches login-screen (threshold: 95%) - threshold not met, current: 88.36466049382716%\n';

test('is_retryable is false for a real captured screenshot comparison failure with header and passed email-input step', () => {
  assert.equal(retryable('id: email-input is visible... COMPLETED\n' + REAL_CMP + HEADER, 1), false);
});

test('is_retryable is false for Image comparison wording (synthetic fixture)', () => {
  assert.equal(retryable('Image comparison failed\n' + HEADER, 1), false);
});

test('is_retryable is true for exit status 124 (timeout)', () => {
  assert.equal(retryable('no recognizable output\n', 124), true);
});

test('is_retryable is true for email-input failure with the screenshots header', () => {
  assert.equal(retryable('Assertion is false: id: email-input is visible\n' + HEADER, 1), true);
});

test('probe falls back to nc when curl is not found', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-nc-'));
  const adb = path.join(dir, 'adb');
  // Synthetic fake: curl missing; only an `nc -w5` command succeeds. nc syntax unverified on real images.
  fs.writeFileSync(adb, `#!/usr/bin/env bash\necho "adb $*" >> "${dir}/calls.log"\nif [ "$1" = shell ]; then case "$2" in *"nc -w5"*) echo packager-status:running ;; *) echo "curl: not found" ;; esac; fi\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'fakesleep'), '#!/usr/bin/env bash\n', { mode: 0o755 });
  const res = spawnSync('bash', [PROBE], { env: { ...process.env, ADB_BIN: adb, SLEEP_BIN: path.join(dir, 'fakesleep'), TIMEOUT_BIN: '' }, encoding: 'utf8' });
  const calls = fs.readFileSync(path.join(dir, 'calls.log'), 'utf8');
  assert.equal(res.status, 0);
  assert.match(calls, /nc -w5/);
});

function probeDiag(adbBody, curlBody, metroLog) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probediag-'));
  if (metroLog !== undefined) fs.writeFileSync(path.join(dir, 'metro.log'), metroLog);
  const w = (n, b) => { fs.writeFileSync(path.join(dir, n), `#!/usr/bin/env bash\n${b}\n`, { mode: 0o755 }); return path.join(dir, n); };
  const res = spawnSync('bash', [PROBE], {
    env: { ...process.env, ADB_BIN: w('adb', adbBody), SLEEP_BIN: w('fakesleep', ''), DIAG_CURL_BIN: w('fakecurl', curlBody), PROBE_ATTEMPTS: '2', GITHUB_WORKSPACE: dir },
    encoding: 'utf8', timeout: 60000,
  });
  return { res, dir };
}

test('on exhaustion probe prints host and emulator diagnostics and still exits 1', () => {
  const { res } = probeDiag('echo "adb-out $*"', 'echo curl-out', 'metro-log-line\n');
  assert.equal(res.status, 1);
  assert.match(res.stdout, /cold-start: emulator cannot reach Metro/);
  assert.match(res.stdout, /probe-diag: == host: metro \/status ==\ncurl-out/);
  assert.match(res.stdout, /metro-log-line/);
  assert.match(res.stdout, /adb-out devices/);
  assert.match(res.stdout, /adb-out reverse --list/);
  assert.match(res.stdout, /adb-out shell getprop sys.boot_completed/);
  assert.match(res.stdout, /adb-out shell ip route/);
  assert.match(res.stdout, /adb-out shell ping -c1 -W2 10.0.2.2/);
  const out = res.stdout + res.stderr;
  assert.ok(out.indexOf('probe-diag:') >= 0 && out.indexOf('probe-diag:') < out.indexOf('::error::cold-start'));
});

test('failing ip route and ping print their failure notes', () => {
  const { res } = probeDiag('if [ "$1" = shell ] && { [ "$2" = ip ] || [ "$2" = "ping -c1 -W2 10.0.2.2" ]; }; then exit 1; fi; echo "adb-out $*"', 'echo curl-out');
  assert.equal(res.status, 1);
  assert.match(res.stdout, /probe-diag: \(ip route failed\)/);
  assert.match(res.stdout, /probe-diag: \(ping failed\)/);
});

test('failing or missing diagnostic commands do not change exit code 1', () => {
  const { res } = probeDiag('exit 3', 'exit 7');
  assert.equal(res.status, 1);
  assert.match(res.stdout, /probe-diag: \(command failed or timed out: host: metro \/status\)/);
  assert.match(res.stdout, /cold-start: emulator cannot reach Metro/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probediag-'));
  fs.writeFileSync(path.join(dir, 'adb'), '#!/usr/bin/env bash\nexit 1\n', { mode: 0o755 });
  const missing = spawnSync('bash', [PROBE], { env: { ...process.env, ADB_BIN: path.join(dir, 'adb'), SLEEP_BIN: 'true', DIAG_CURL_BIN: '/nonexistent/curl', PROBE_ATTEMPTS: '1', GITHUB_WORKSPACE: dir }, encoding: 'utf8' });
  assert.equal(missing.status, 1);
});

test('a hanging diagnostic command is bounded by the timeout and exit stays 1', { skip: !require('node:child_process').spawnSync('bash', ['-c', 'command -v timeout']).stdout.length }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'probediag-'));
  fs.writeFileSync(path.join(dir, 'adb'), '#!/usr/bin/env bash\nsleep 30\n', { mode: 0o755 });
  const r = spawnSync('bash', [PROBE], { env: { ...process.env, ADB_BIN: path.join(dir, 'adb'), SLEEP_BIN: 'true', PROBE_ADB_TIMEOUT: '1', DIAG_CURL_BIN: 'true', PROBE_ATTEMPTS: '1', GITHUB_WORKSPACE: dir }, encoding: 'utf8', timeout: 50000 });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /cold-start/);
});
