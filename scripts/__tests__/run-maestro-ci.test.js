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

function run(flows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-ci-'));
  const flowsDir = path.join(dir, 'flows');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(flowsDir);
  fs.mkdirSync(bin);
  for (const name of Object.keys(flows)) fs.writeFileSync(path.join(flowsDir, `${name}.yaml`), '');
  // Fake maestro: behaviour chosen by the flow file name.
  fs.writeFileSync(
    path.join(bin, 'maestro'),
    `#!/usr/bin/env bash\nn=$(basename "$2" .yaml)\ncase "$n" in\n  fail*) echo "Comparison error: x"; exit 1;;\n  hang*) exec sleep 30;;\n  *) exit 0;;\nesac\n`,
    { mode: 0o755 }
  );
  if (!hasRealTimeout) {
    fs.writeFileSync(
      path.join(bin, 'timeout'),
      '#!/usr/bin/env bash\nd=$1; shift\n"$@" & p=$!\n( sleep "$d"; kill $p 2>/dev/null ) & w=$!\nwait $p; rc=$?\nkill $w 2>/dev/null\n[ $rc -ge 128 ] && exit 124\nexit $rc\n',
      { mode: 0o755 }
    );
  }
  const res = spawnSync('bash', [SCRIPT], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, MAESTRO_FLOWS_DIR: flowsDir, GITHUB_WORKSPACE: dir, FLOW_TIMEOUT: '1' },
    encoding: 'utf8',
  });
  return { res, summary: fs.readFileSync(path.join(dir, 'visual-result.txt'), 'utf8') };
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
