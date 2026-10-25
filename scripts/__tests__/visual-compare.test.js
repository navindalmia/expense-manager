'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectRuns, similarityFor, render } = require('../visual-compare');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-test-'));
  const mk = (shard, stamp, flow, cmds) => {
    const dir = path.join(root, `maestro-debug-output-${shard}`, stamp, flow);
    fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'screenshots', 'step-001-assertScreenshot.png'), stamp);
    if (cmds) fs.writeFileSync(path.join(dir, 'commands.json'), JSON.stringify(cmds));
    return dir;
  };
  return { root, mk };
}

test('collectRuns keeps the last attempt per flow', () => {
  const { root, mk } = fixture();
  mk(1, '2026-10-24_100000', 'flow-a');
  mk(1, '2026-10-24_100500', 'flow-a');
  mk(2, '2026-10-24_100200', 'flow-b');
  const runs = collectRuns(root);
  assert.deepEqual(runs.map((r) => [r.flow, r.stamp]), [['flow-a', '2026-10-24_100500'], ['flow-b', '2026-10-24_100200']]);
});

test('similarityFor reads the failed percentage and a missing baseline', () => {
  const { mk } = fixture();
  const failed = mk(1, 's1', 'f', [{ metadata: { status: 'FAILED', error: { message: 'threshold not met, current: 94.9266%' } } }]);
  const missing = mk(1, 's2', 'g', [{ metadata: { status: 'FAILED', error: { message: 'Screenshot file not found: x.png' } } }]);
  const ok = mk(1, 's3', 'h', [{ metadata: { status: 'COMPLETED' } }]);
  assert.match(similarityFor(failed), /94\.93% similar \(FAILED/);
  assert.match(similarityFor(missing), /no baseline committed/);
  assert.equal(similarityFor(ok), 'passed');
});

test('render escapes names and flags failures', () => {
  const html = render([{ flow: '<x>', baseline: null, actual: 'img/a.png', status: '90% similar (FAILED, threshold 95%)' }], 't');
  assert.match(html, /&lt;x&gt;/);
  assert.match(html, /class="bad"/);
  assert.match(html, /no baseline/);
});
