// e2e coverage rules: static scan of e2e/regression, e2e-eval, fail-closed blob reads. Run with: npm run test:gate
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const g = require('../regression-gate');

const CLI = path.join(__dirname, '..', 'regression-gate.js');
const entry = (rel, src) => ({ rel, content: () => src });

test('banned modifiers now include fixme, fail, and conditional .skip( / .fixme( calls', () => {
  for (const src of ["test.fixme('a', () => {});", "test.fail('a', () => {});", "test.describe.skip('a', () => {});",
    "test.describe.fixme('a', () => {});", "test.describe.only('a', () => {});", "test('a', async ({ page }) => { test.skip(true, 'x'); });",
    "test('a', async ({}, testInfo) => { testInfo.skip(); });", "test.skip('a', () => {});", "test.only('a', () => {});"]) {
    assert.strictEqual(g.hasBannedTestModifier(src), true, src);
  }
  assert.strictEqual(g.hasBannedTestModifier("test('a', async () => { await expect(1).toBe(1); });"), false);
});
test('e2e/regression is statically scanned: banned modifiers and undiscoverable files are problems', () => {
  const r = g.checkEntries('e2e', [
    entry('e2e/regression/issue-1-a.spec.ts', "test.skip('a', () => {});"),
    entry('e2e/regression/issue-2-b.spec.ts', "test.fixme('a', () => {});"),
    entry('e2e/regression/issue-3-c.spec.ts', "test('ok', async () => { expect(1).toBe(1); });"),
    entry('e2e/regression/notes.md', 'x'),
    entry('e2e/regression/.gitkeep', ''),
  ]);
  assert.strictEqual(r.problems.length, 3);
  assert.ok(r.problems.some((p) => p.startsWith('e2e/regression/notes.md')));
});
test('unreadable blob fails closed (null content is a problem, not a pass)', () => {
  const r = g.checkEntries('backend', [{ rel: 'backend/src/__tests__/regression/issue-1-a.test.ts', content: () => null }]);
  assert.strictEqual(r.problems.length, 1);
  assert.match(r.problems[0], /failing closed/);
});
test('e2e stats: all-skipped, zero-test, failed and flaky runs fail; a clean pass succeeds', () => {
  assert.strictEqual(g.evaluateE2eStats({ expected: 0, unexpected: 0, flaky: 0, skipped: 3 }).ok, false); // all skipped
  assert.strictEqual(g.evaluateE2eStats({ expected: 0, unexpected: 0, flaky: 0, skipped: 0 }).ok, false); // zero tests
  assert.strictEqual(g.evaluateE2eStats({ expected: 2, unexpected: 0, flaky: 0, skipped: 1 }).ok, false); // partial skip
  assert.strictEqual(g.evaluateE2eStats({ expected: 2, unexpected: 1, flaky: 0, skipped: 0 }).ok, false);
  assert.strictEqual(g.evaluateE2eStats({ expected: 2, unexpected: 0, flaky: 1, skipped: 0 }).ok, false);
  assert.strictEqual(g.evaluateE2eStats(undefined).ok, false);
  assert.strictEqual(g.evaluateE2eStats({ expected: 1, unexpected: 0, flaky: 0, skipped: 0 }).ok, true);
});
test('e2e-eval CLI mode: reads a Playwright JSON report; missing/garbage file fails', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-e2e-'));
  const write = (n, o) => { const f = path.join(d, n); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); return f; };
  const run = (f) => spawnSync('node', [CLI, 'e2e-eval', f], { encoding: 'utf8' }).status;
  assert.strictEqual(run(write('ok.json', { stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 } })), 0);
  assert.strictEqual(run(write('skipped.json', { stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 1 } })), 1);
  assert.strictEqual(run(write('zero.json', { stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 } })), 1);
  assert.strictEqual(run(write('bad.json', 'not json')), 1);
  assert.strictEqual(run(path.join(d, 'missing.json')), 1);
  fs.rmSync(d, { recursive: true, force: true });
});
test('CLI static mode blocks an e2e spec with test.skip / test.fixme in the staged index', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-e2e-repo-'));
  const sh = (a, c = 'git') => spawnSync(c, a, { cwd: d, encoding: 'utf8' });
  sh(['init', '-q', '-b', 'main']);
  fs.mkdirSync(path.join(d, 'e2e/regression'), { recursive: true });
  const f = path.join(d, 'e2e/regression/issue-9-a.spec.ts');
  fs.writeFileSync(f, "test('ok', async () => { expect(1).toBe(1); });");
  sh(['add', '-A']);
  assert.strictEqual(sh([CLI, 'static'], 'node').status, 0);
  fs.writeFileSync(f, "test.fixme('a', async () => { expect(1).toBe(1); });");
  sh(['add', '-A']);
  const r = sh([CLI, 'static'], 'node');
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /e2e\/regression\/issue-9-a\.spec\.ts/);
  fs.rmSync(d, { recursive: true, force: true });
});
