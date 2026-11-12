// Run with: npm run test:gate
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const g = require('../regression-gate');

const REG = 'backend/src/__tests__/regression/issue-1-x.test.ts';
const GOOD = "it('works', () => { expect(1).toBe(1); });";
const A = (p) => ({ status: 'A', path: p });
const reader = (c) => () => c;
const ok = (m, ch, c = GOOD) => g.evaluateCommit(m, ch, reader(c)).ok;

test('fix commit without regression file is blocked', () => {
  assert.strictEqual(ok('fix(auth): thing', [A('backend/src/a.ts')]), false);
  assert.strictEqual(ok('fix: thing', [A('README.md')]), false);
});
test('fix commit with a new qualifying file is allowed', () => {
  assert.strictEqual(ok('fix(auth): thing', [A('backend/src/a.ts'), A(REG)]), true);
  assert.strictEqual(ok('fix: x', [A('frontend/src/__tests__/regression/issue-2-y.test.tsx')]), true);
});
test('modified/whitespace-touched existing file does not qualify', () => {
  assert.strictEqual(ok('fix: x', [{ status: 'M', path: REG }]), false);
});
test('e2e regression alone does not qualify', () => {
  assert.strictEqual(ok('fix: x', [A('e2e/regression/issue-2-y.spec.ts')]), false);
});
test('.gitkeep, README, badly named files do not qualify', () => {
  assert.strictEqual(ok('fix: x', [A('backend/src/__tests__/regression/.gitkeep')]), false);
  assert.strictEqual(ok('fix: x', [A('backend/src/__tests__/regression/README.md')]), false);
  assert.strictEqual(ok('fix: x', [A('backend/src/__tests__/regression/foo.test.ts')]), false);
});
test('backend .tsx/.js is not discoverable so does not qualify; frontend .tsx does', () => {
  assert.strictEqual(ok('fix: x', [A('backend/src/__tests__/regression/issue-3-a.test.tsx')]), false);
  assert.strictEqual(ok('fix: x', [A('backend/src/__tests__/regression/issue-3-a.test.js')]), false);
  assert.strictEqual(ok('fix: x', [A('frontend/src/__tests__/regression/issue-3-a.test.js')]), true);
});
test('empty, skip-only, todo, only files do not qualify', () => {
  assert.strictEqual(ok('fix: x', [A(REG)], ''), false);
  assert.strictEqual(ok('fix: x', [A(REG)], "it.skip('a', () => {});"), false);
  assert.strictEqual(ok('fix: x', [A(REG)], "describe('a', () => {});"), false);
  assert.strictEqual(ok('fix: x', [A(REG)], "// it('commented', () => {})"), false);
  assert.strictEqual(ok('fix: x', [A(REG)], GOOD + "\nit.todo('b')"), false);
  assert.strictEqual(ok('fix: x', [A(REG)], "test.only('a', () => {})"), false);
});
test('Regression-Exempt trailer allows a fix commit', () => {
  assert.strictEqual(ok('fix: x\n\nRegression-Exempt: docs-only typo', []), true);
  assert.strictEqual(ok('fix: x\n\nRegression-Exempt:', [A('README.md')]), false);
});
test('non-fix commit is allowed', () => {
  assert.strictEqual(ok('feat: x', []), true);
  assert.strictEqual(ok('chore: prefix fix: nope', [A('a.ts')]), true);
});
test('widened fix detection: bugfix, hotfix, fixup!, spacing; comments and blank lines skipped', () => {
  for (const m of ['bugfix: a', 'hotfix(x): a', 'fixup! fix: a', 'squash! fix(a): b', 'Fix (a) : b', 'fix!: b', 'fix(a)!: b',
    '\n\n# comment\nfix: after comments']) {
    assert.strictEqual(g.isFixCommit(m), true, m);
  }
  for (const m of ['feat: fix thing', 'fixture: x', 'prefix: fix', '# fix: only a comment\nchore: x']) {
    assert.strictEqual(g.isFixCommit(m), false, m);
  }
});
test('deleting or moving away a regression test needs Regression-Exempt (any commit type)', () => {
  const d = [{ status: 'D', path: REG }];
  assert.strictEqual(ok('chore: cleanup', d), false);
  assert.strictEqual(ok('chore: cleanup\n\nRegression-Exempt: obsolete feature removed', d), true);
  assert.strictEqual(ok('chore: x', [{ status: 'D', path: 'backend/src/__tests__/regression/.gitkeep' }]), true);
  assert.strictEqual(ok('chore: x', [{ status: 'D', path: 'e2e/regression/issue-1-a.spec.ts' }]), false);
});
test('pure message-only reword of a fix commit is allowed (CI pr mode re-checks)', () => {
  assert.strictEqual(ok('fix: reworded', []), true);
});
test('runner result: missing runner, timeout, failure, zero tests, skipped all fail closed', () => {
  const good = { passed: 1, failed: 0, pending: 0, todo: 0 };
  assert.strictEqual(g.evaluateRunnerResult('backend', { error: new Error('ENOENT'), status: null }, good).ok, false);
  assert.strictEqual(g.evaluateRunnerResult('backend', { error: new Error('spawnSync npm ETIMEDOUT'), status: null }, good).ok, false);
  assert.strictEqual(g.evaluateRunnerResult('backend', undefined, good).ok, false);
  assert.strictEqual(g.evaluateRunnerResult('backend', { status: 1 }, good).ok, false);
  assert.strictEqual(g.evaluateRunnerResult('backend', { status: 0 }, null).ok, false);
  assert.strictEqual(g.evaluateRunnerResult('backend', { status: 0 }, { ...good, passed: 0 }).ok, false);
  assert.strictEqual(g.evaluateRunnerResult('backend', { status: 0 }, { ...good, pending: 1 }).ok, false);
  assert.strictEqual(g.evaluateRunnerResult('backend', { status: 0 }, { ...good, todo: 1 }).ok, false);
  assert.strictEqual(g.evaluateRunnerResult('backend', { status: 0 }, good).ok, true);
});
test('NUL-separated name-status parsing handles spaces/newlines in paths', () => {
  const c = g.parseNameStatusZ('A\0dir/a b.ts\0D\0we\nird.ts\0');
  assert.deepStrictEqual(c, [{ status: 'A', path: 'dir/a b.ts' }, { status: 'D', path: 'we\nird.ts' }]);
});
test('scanWorkspace is recursive and flags undiscoverable / banned files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-scan-'));
  const dir = path.join(root, 'backend/src/__tests__/regression/sub');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'issue-1-a.test.ts'), GOOD);
  let r = g.scanWorkspace(root, 'backend');
  assert.strictEqual(r.tests.length, 1);
  assert.strictEqual(r.problems.length, 0);
  fs.writeFileSync(path.join(dir, 'issue-2-b.test.js'), GOOD);
  fs.writeFileSync(path.join(dir, 'issue-3-c.test.ts'), "it.skip('x', () => {})");
  r = g.scanWorkspace(root, 'backend');
  assert.strictEqual(r.problems.length, 2);
  fs.rmSync(root, { recursive: true, force: true });
});

// --- squash-merge layouts: GitHub appends a Co-authored-by-only paragraph (and a "---------" separator) ---
const SQUASH_173 = `fix(ci): staging release notes cover everything since the last published release (#173)

Release notes now span the commits since the newest published staging-* release.

Regression-Exempt: CI workflow and release-notes tooling; covered by node:test unit and CLI tests in scripts/__tests__ run via test:gate

Co-authored-by: Claude Sonnet 5.5 <noreply@anthropic.com>
`;
const SQUASH_168 = `fix(ci): probe diagnostics (#168)

* fix(ci): keep captured ip route/ping output when the command fails

Print the captured output before the failure note so the diagnostic is not
lost, and add a test for it. Label the fake adb as synthetic.

Regression-Exempt: probe diagnostics script, covered by scripts/__tests__/probe-metro-android.test.js
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Sonnet 5.5 <noreply@anthropic.com>
`;
test('squash layout of #173 (exemption, blank line, Co-authored-by paragraph) is exempt', () => {
  assert.strictEqual(g.hasExemption(SQUASH_173), true);
});
test('squash layout of #168 (trailers, ---------, Co-authored-by paragraph) is exempt', () => {
  assert.strictEqual(g.hasExemption(SQUASH_168), true);
});
test('multiple trailing co-author lines are stripped', () => {
  const m = 'fix: x\n\nRegression-Exempt: why\n\nCo-authored-by: A <a@x.io>\nco-authored-by: B <b@x.io>\n';
  assert.strictEqual(g.hasExemption(m), true);
});
test('exemption mid-body is still not honoured after a squash appendix', () => {
  const m = 'fix: x\n\nRegression-Exempt: why\n\nMore prose here.\n\nCo-authored-by: A <a@x.io>\n';
  assert.strictEqual(g.hasExemption(m), false);
});
test('a paragraph mixing prose and Co-authored-by is not stripped', () => {
  const m = 'fix: x\n\nRegression-Exempt: why\n\nthanks!\nCo-authored-by: A <a@x.io>\n';
  assert.strictEqual(g.hasExemption(m), false);
});
test('exemption followed by prose then separator and co-author is not honoured', () => {
  assert.strictEqual(g.hasExemption('fix: x\n\nRegression-Exempt: why\n\nprose\n\n---------\n\nCo-authored-by: A <a@x.io>\n'), false);
});
test('no exemption at all stays blocked, with or without a co-author paragraph', () => {
  assert.strictEqual(g.hasExemption('fix: x\n\nbody\n\nCo-authored-by: A <a@x.io>\n'), false);
  assert.strictEqual(g.hasExemption('fix: x\n\nbody\n'), false);
  assert.strictEqual(g.hasExemption('Co-authored-by: A <a@x.io>'), false);
});
test('co-author paragraph that is not final is not stripped', () => {
  const m = 'fix: x\n\nRegression-Exempt: why\n\nCo-authored-by: A <a@x.io>\n\nclosing prose\n';
  assert.strictEqual(g.hasExemption(m), false);
});
test('PR mode: squash-layout fix commit with exemption passes, without exemption fails', () => {
  const ok = g.evaluatePr([{ message: SQUASH_168, changes: [] }], [], {}, {});
  assert.strictEqual(ok.ok, true);
  const bad = g.evaluatePr([{ message: 'fix: x\n\nbody\n\nCo-authored-by: A <a@x.io>\n', changes: [] }], [], {}, {});
  assert.strictEqual(bad.ok, false);
});
