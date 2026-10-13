'use strict';

// Guards the e2e-mobile runner: every flow runs, a failing/hanging flow is
// recorded and fails the script only AFTER all flows ran (no silent pass).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'run-maestro-ci.sh');
// real `timeout` on CI (Linux); a shim stands in on macOS
const hasRealTimeout = spawnSync('timeout', ['--version']).status === 0;

function run(flows, quarantine, extraEnv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-ci-'));
  const flowsDir = path.join(dir, 'flows');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(flowsDir);
  fs.mkdirSync(bin);
  if (quarantine !== undefined) fs.writeFileSync(path.join(dir, 'quarantine.txt'), quarantine);
  for (const name of Object.keys(flows)) fs.writeFileSync(path.join(flowsDir, `${name}.yaml`), '');
  // Fake maestro: behaviour chosen by the flow file name.
  fs.writeFileSync(
    path.join(bin, 'maestro'),
    `#!/usr/bin/env bash\nn=$(basename "$2" .yaml)\ncase "$n" in\n  flaky*) c=\"$(dirname \"$0\")/$n.count\"; k=$(cat \"$c\" 2>/dev/null || echo 0); echo $((k+1)) > \"$c\"; if [ \"$k\" -lt \"\${FLAKY_FAILS:-1}\" ]; then echo \"Assertion is false: id: email-input is visible\"; exit 1; fi; exit 0;;\n  unable*) echo \"Unable to launch app\"; exit 1;;\n  shot*) echo \"Assertion is false: screenshot Comparison error\"; exit 1;;\n  other*) echo \"Assertion is false: id: save-button is visible\"; exit 1;;\n  fail*) echo "Comparison error: x"; exit 1;;\n  hang*) exec sleep 30;;\n  *) exit 0;;\nesac\n`,
    { mode: 0o755 }
  );
  fs.writeFileSync(path.join(bin, 'adb'), `#!/usr/bin/env bash\necho "adb $*" >> "${dir}/calls.log"\ncat >/dev/null\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'fakesleep'), `#!/usr/bin/env bash\necho "sleep $*" >> "${dir}/calls.log"\n`, { mode: 0o755 });
  if (!hasRealTimeout) {
    fs.writeFileSync(
      path.join(bin, 'timeout'),
      '#!/usr/bin/env bash\nd=$1; shift\n"$@" & p=$!\n( sleep "$d"; kill $p 2>/dev/null ) & w=$!\nwait $p; rc=$?\nkill $w 2>/dev/null\n[ $rc -ge 128 ] && exit 124\nexit $rc\n',
      { mode: 0o755 }
    );
  }
  const res = spawnSync('bash', [SCRIPT], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MAESTRO_FLOWS_DIR: flowsDir, MAESTRO_QUARANTINE_FILE: path.join(dir, 'quarantine.txt'), GITHUB_WORKSPACE: dir, FLOW_TIMEOUT: '1', SLEEP_BIN: 'fakesleep', ...(extraEnv || {}) },
    encoding: 'utf8',
  });
  const calls = fs.existsSync(path.join(dir, 'calls.log')) ? fs.readFileSync(path.join(dir, 'calls.log'), 'utf8') : '';
  return { res, calls, summary: fs.readFileSync(path.join(dir, 'visual-result.txt'), 'utf8') };
}

test('passes when every flow passes', () => {
  const { res, summary } = run({ a: 1, b: 1 });
  assert.equal(res.status, 0);
  assert.match(summary, /\[Passed\] a/);
});

test('a failing flow fails the script but later flows still run', () => {
  const { res, summary } = run({ a: 1, fail1: 1, z: 1 });
  assert.notEqual(res.status, 0);
  assert.match(summary, /\[Failed\] fail1/);
  assert.match(summary, /\[Passed\] z/);
});

test('a hanging flow is recorded as Timeout, later flows run, script fails', () => {
  const { res, summary } = run({ hang1: 1, z: 1 });
  assert.notEqual(res.status, 0);
  assert.match(summary, /\[Timeout\] hang1/);
  assert.match(summary, /\[Passed\] z/);
});

test('a quarantined failing flow does not fail the job but is reported', () => {
  const { res, summary } = run({ a: 1, fail1: 1, z: 1 }, '# comment\nfail1  #100  known failing\n');
  assert.equal(res.status, 0);
  assert.match(summary, /QUARANTINED \(known failing, issue #100\): fail1/);
  assert.doesNotMatch(summary, /\[Failed\]/);
  assert.match(summary, /\[Passed\] z/);
});

test('a non-quarantined failing flow still fails when another is quarantined', () => {
  const { res, summary } = run({ fail1: 1, fail2: 1 }, 'fail1  #100  reason\n');
  assert.notEqual(res.status, 0);
  assert.match(summary, /\[Failed\] fail2/);
  assert.match(summary, /QUARANTINED \(known failing, issue #100\): fail1/);
});

test('a quarantined flow that passes reports the removal hint', () => {
  const { res, summary } = run({ a: 1 }, 'a  #100  reason\n');
  assert.equal(res.status, 0);
  assert.match(summary, /QUARANTINED FLOW NOW PASSING - remove it from the list/);
});

test('missing or empty quarantine list behaves strictly as before', () => {
  for (const q of [undefined, '', '# only comments\n']) {
    const { res, summary } = run({ fail1: 1 }, q);
    assert.notEqual(res.status, 0);
    assert.match(summary, /\[Failed\] fail1/);
    assert.doesNotMatch(summary, /QUARANTINED/);
  }
});

const PKG = 'com.navindalmia.expensemanager';

test('resets the app (force-stop, pm clear, HOME, settle) before each flow attempt', () => {
  const { calls } = run({ a: 1 });
  const lines = calls.trim().split('\n');
  assert.deepEqual(lines.slice(0, 4), [`adb shell am force-stop ${PKG}`, `adb shell pm clear ${PKG}`, 'adb shell input keyevent KEYCODE_HOME', 'sleep 4']);
});

test('a launch-style failure that passes on retry is FLAKY, counted, and the job passes', () => {
  const { res, summary, calls } = run({ flaky1: 1 });
  assert.equal(res.status, 0);
  assert.match(summary, /FLAKY \(passed on attempt 2\) flaky1/);
  assert.match(summary, /Flaky flows: 1/);
  assert.equal((calls.match(/pm clear/g) || []).length, 2);
  assert.match(calls, /sleep 10/);
});

test('retries launch failures up to 3 attempts then fails', () => {
  const { res, summary, calls } = run({ unable1: 1 });
  assert.notEqual(res.status, 0);
  assert.match(summary, /\[Failed\] unable1/);
  assert.equal((calls.match(/pm clear/g) || []).length, 3);
});

test('email-input launch failure passing on attempt 3 is FLAKY attempt 3', () => {
  const { res, summary } = run({ flaky1: 1 }, undefined, { FLAKY_FAILS: '2' });
  assert.equal(res.status, 0);
  assert.match(summary, /FLAKY \(passed on attempt 3\)/);
});

test('screenshot mismatches are never retried', () => {
  const { res, summary, calls } = run({ shot1: 1 });
  assert.notEqual(res.status, 0);
  assert.match(summary, /\[Failed\] shot1/);
  assert.equal((calls.match(/pm clear/g) || []).length, 1);
});

test('other assertion failures are never retried', () => {
  const { res, calls } = run({ other1: 1 });
  assert.notEqual(res.status, 0);
  assert.equal((calls.match(/pm clear/g) || []).length, 1);
});

test('a flow timeout is retried', () => {
  const { calls } = run({ hang1: 1 });
  assert.equal((calls.match(/pm clear/g) || []).length, 3);
});

test('adb reading stdin does not swallow the flow list: all flows execute', () => {
  const { res, summary } = run({ a: 1, b: 1, c: 1 });
  assert.equal(res.status, 0);
  for (const n of ['a', 'b', 'c']) assert.match(summary, new RegExp(`\\[Passed\\] ${n}`));
  assert.match(summary, /Flows planned: 3, executed: 3/);
});

test('executed < planned fails the job', () => {
  const { res, summary } = run({ a: 1, b: 1, c: 1 }, undefined, { MAESTRO_TEST_SKIP_AFTER: '1' });
  assert.notEqual(res.status, 0);
  assert.match(summary, /Flows planned: 3, executed: 1/);
});

test('quarantined flows count as executed', () => {
  const { res, summary } = run({ a: 1, fail1: 1 }, 'fail1  #1  r\n');
  assert.equal(res.status, 0);
  assert.match(summary, /Flows planned: 2, executed: 2/);
});
