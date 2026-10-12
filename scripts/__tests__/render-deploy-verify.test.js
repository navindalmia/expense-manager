'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'render-deploy-verify.sh');

// Fake curl: serves queued responses from $FAKE_DIR/responses (one per line), logs calls.
function setup(responses) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rdv-'));
  fs.writeFileSync(path.join(dir, 'responses'), responses.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'n'), '0');
  fs.writeFileSync(
    path.join(dir, 'curl'),
    `#!/bin/bash
echo "$@" >> "$FAKE_DIR/calls"
n=$(cat "$FAKE_DIR/n"); n=$((n+1)); echo $n > "$FAKE_DIR/n"
line=$(sed -n "\${n}p" "$FAKE_DIR/responses")
[ -z "$line" ] && line=$(tail -n1 "$FAKE_DIR/responses")
[ "$line" = "FAIL" ] && exit 22
printf '%s' "$line"
`,
    { mode: 0o755 }
  );
  return dir;
}

function run(args, dir, extra = {}) {
  return spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FAKE_DIR: dir,
      RENDER_API_KEY: 'k', SLEEP_SECONDS: '0', MAX_ATTEMPTS: '3', ...extra },
  });
}

test('deploy succeeds when the deploy reaches live', () => {
  const dir = setup(['{"id":"dep-1"}', '{"status":"build_in_progress"}', '{"status":"live"}']);
  const r = run(['deploy', 'srv-x'], dir);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(fs.readFileSync(path.join(dir, 'calls'), 'utf8'), /srv-x\/deploys\/dep-1/);
});

test('deploy fails on build_failed', () => {
  const dir = setup(['{"id":"dep-1"}', '{"status":"build_failed"}']);
  const r = run(['deploy', 'srv-x'], dir);
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /build_failed/);
});

test('deploy fails when Render returns no deploy id', () => {
  const dir = setup(['{}']);
  assert.notStrictEqual(run(['deploy', 'srv-x'], dir).status, 0);
});

test('deploy times out when never live', () => {
  const dir = setup(['{"id":"dep-1"}', '{"status":"build_in_progress"}']);
  const r = run(['deploy', 'srv-x'], dir);
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /Timed out/);
});

test('smoke passes when body has the marker and hits the root URL', () => {
  const dir = setup(['Expense Manager API running']);
  const r = run(['smoke', 'https://h.example.com/api'], dir);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(fs.readFileSync(path.join(dir, 'calls'), 'utf8'), /https:\/\/h\.example\.com\/\s*$/m);
});

test('smoke fails after retries when unhealthy', () => {
  const dir = setup(['FAIL']);
  const r = run(['smoke', 'https://h.example.com/api'], dir);
  assert.notStrictEqual(r.status, 0);
});

test('smoke skips with a warning (exit 0) when the URL is empty', () => {
  const dir = setup(['FAIL']);
  const r = run(['smoke', ''], dir);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /::warning::/);
});
