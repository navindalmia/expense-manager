// Round-2 rules + CLI integration. Run with: npm run test:gate
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const g = require('../regression-gate');
const { decideInstall } = require('../install-hooks');

const REG = 'backend/src/__tests__/regression/issue-1-x.test.ts';
const GOOD = "it('works', () => { expect(1).toBe(1); });";
const A = (p) => ({ status: 'A', path: p });
const reader = (c) => () => c;
const ok = (m, ch, c = GOOD) => g.evaluateCommit(m, ch, reader(c)).ok;
const mk = (message, changes) => ({ message, changes });

test('vacuous files do not qualify: regex.test, no assertion, it.fails, expect.fail, identifier ending in it', () => {
  assert.strictEqual(ok('fix: x', [A(REG)], "const r = /a/; r.test('a');"), false);
  assert.strictEqual(ok('fix: x', [A(REG)], "it('a', () => { doThing(); });"), false);
  assert.strictEqual(ok('fix: x', [A(REG)], "it.fails('a', () => { expect(1).toBe(2); });"), false);
  assert.strictEqual(ok('fix: x', [A(REG)], "it('a', () => { expect.fail('x'); });"), false);
  assert.strictEqual(ok('fix: x', [A(REG)], "submit('a'); expect(1).toBe(1);"), false);
  assert.strictEqual(ok('fix: x', [A(REG)], "test('a', () => { assert.equal(1, 1); });"), true);
  assert.strictEqual(g.countTests("r.test(x); it('a', () => {}); test.each([1])('b', () => {})"), 2);
});
test('fix detection: words, [fix], fixes #N, BOM/NBSP/emoji prefixes, no fixture/prefix false positives', () => {
  for (const m of ['Fix login redirect', 'fixes #46: x', 'fix #46', '[fix] x', 'bugfix - x', '﻿fix: x', ' fix: x',
    '\u{1F41B} fix: x', 'Fixed the thing', 'hotfix login']) assert.strictEqual(g.isFixCommit(m), true, m);
  for (const m of ['fixture: x', 'prefix: fix', 'feat: fix thing', 'Fixtures update', 'refactor: x']) {
    assert.strictEqual(g.isFixCommit(m), false, m);
  }
});
test('exemption must be a real trailer in the last paragraph', () => {
  assert.strictEqual(g.hasExemption('fix: x\nRegression-Exempt: sneaky in subject block'), false);
  assert.strictEqual(g.hasExemption('fix: x\n\nRegression-Exempt: ok\n\nmore prose'), false);
  assert.strictEqual(g.hasExemption('fix: x\n\nbody\n\nRegression-Exempt: ok\nSigned-off-by: a'), true);
  assert.strictEqual(g.hasExemption('Regression-Exempt: only subject'), false);
});
test('PR mode: exemption only exempts the commit carrying it', () => {
  const io = { readNew: reader(GOOD) };
  const fixNoTest = mk('fix: a', [A('a.ts')]);
  const otherExempt = mk('chore: b\n\nRegression-Exempt: unrelated', [A('b.ts')]);
  assert.strictEqual(g.evaluatePr([otherExempt, fixNoTest], [A('a.ts'), A('b.ts')], io).ok, false);
  assert.strictEqual(g.evaluatePr([mk('fix: a\n\nRegression-Exempt: why', [A('a.ts')])], [A('a.ts')], io).ok, true);
  assert.strictEqual(g.evaluatePr([mk('fix: a', [A(REG)])], [A(REG)], io).ok, true);
  assert.strictEqual(g.evaluatePr([mk('feat: b', [A('a.ts')])], [A('a.ts')], io).ok, true);
  assert.strictEqual(g.evaluatePr([mk('fix: a', [A(REG)])], [A(REG)], { readNew: reader("it.skip('x',()=>{})") }).ok, false);
});
test('PR mode: fix/ branch and fix-like title are fix signals; tip exemption clears them', () => {
  const io = { readNew: reader(GOOD) };
  const c = [mk('feat: x', [A('a.ts')])];
  assert.strictEqual(g.evaluatePr(c, [A('a.ts')], io, { branch: 'fix/login' }).ok, false);
  assert.strictEqual(g.evaluatePr(c, [A('a.ts')], io, { title: 'Fix login redirect' }).ok, false);
  assert.strictEqual(g.evaluatePr(c, [A('a.ts')], io, { branch: 'feat/x', title: 'Add x' }).ok, true);
  assert.strictEqual(g.evaluatePr([mk('feat: x\n\nRegression-Exempt: r', [])], [], io, { branch: 'fix/login' }).ok, true);
  assert.strictEqual(g.evaluatePr(c, [A(REG)], io, { branch: 'fix/login' }).ok, true);
});
test('PR mode: deletion/weakening needs exemption on a commit touching that file', () => {
  const D = { status: 'D', path: REG };
  assert.strictEqual(g.evaluatePr([mk('chore: x', [D])], [D], {}).ok, false);
  assert.strictEqual(g.evaluatePr([mk('chore: x\n\nRegression-Exempt: r', [D])], [D], {}).ok, true);
  assert.strictEqual(g.evaluatePr([mk('chore: y\n\nRegression-Exempt: r', [A('z.ts')]), mk('chore: x', [D])], [D], {}).ok, false);
  const M = { status: 'M', path: REG };
  const io = { readBase: reader(GOOD), readNew: reader("it('a', () => {});") };
  assert.strictEqual(g.evaluatePr([mk('chore: x', [M])], [M], io).ok, false);
});
test('commit stage: M that decreases tests or assertions needs exemption; neutral/increase allowed', () => {
  const M = [{ status: 'M', path: REG }];
  const two = "it('a',()=>{expect(1).toBe(1);expect(2).toBe(2);});";
  const one = "it('a',()=>{expect(1).toBe(1);});";
  const ev = (msg, oldC, newC) => g.evaluateCommit(msg, M, () => newC, () => oldC).ok;
  assert.strictEqual(ev('chore: x', one, "it('a', () => {});"), false);
  assert.strictEqual(ev('chore: x', two, one), false);
  assert.strictEqual(ev('chore: x\n\nRegression-Exempt: r', one, "it('a', () => {});"), true);
  assert.strictEqual(ev('chore: x', one, two), true);
  assert.strictEqual(ev('chore: x', one, one + '\n// note'), true);
});
test('rename parse: R becomes D old + A new; C becomes A new', () => {
  assert.deepStrictEqual(g.parseNameStatusZ('R100\0old.ts\0new.ts\0M\0m.ts\0'), [
    { status: 'D', path: 'old.ts' }, { status: 'A', path: 'new.ts' }, { status: 'M', path: 'm.ts' }]);
  assert.deepStrictEqual(g.parseNameStatusZ('C90\0a\0b\0'), [{ status: 'A', path: 'b' }]);
});
test('install-hooks decisions: CI, foreign hooksPath, no repo, already, install', () => {
  assert.strictEqual(decideInstall({ inRepo: true, current: '', ci: true }), 'skip-ci');
  assert.strictEqual(decideInstall({ inRepo: true, current: '.husky', ci: false }), 'skip-foreign');
  assert.strictEqual(decideInstall({ inRepo: false, current: '', ci: false }), 'skip-no-repo');
  assert.strictEqual(decideInstall({ inRepo: true, current: '.githooks', ci: false }), 'already');
  assert.strictEqual(decideInstall({ inRepo: true, current: '', ci: false }), 'install');
});
test('runWithTimeout fails closed on timeout and on missing binary', async () => {
  const t = await g.runWithTimeout(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { stdio: 'ignore' }, 300);
  assert.strictEqual(g.evaluateRunnerResult('x', t, { passed: 1 }).ok, false);
  assert.ok(t.error);
  const m = await g.runWithTimeout('definitely-not-a-binary-xyz', [], { stdio: 'ignore' }, 2000);
  assert.strictEqual(g.evaluateRunnerResult('x', m, { passed: 1 }).ok, false);
});

// Integration: real git repo, real CLI modes.
const CLI = path.join(__dirname, '..', 'regression-gate.js');
function sh(cwd, cmd, args, env = {}) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
}
function tmpRepo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-it-'));
  sh(d, 'git', ['init', '-q', '-b', 'main']);
  sh(d, 'git', ['config', 'user.email', 't@t']);
  sh(d, 'git', ['config', 'user.name', 't']);
  sh(d, 'git', ['config', 'core.hooksPath', '/dev/null']);
  fs.writeFileSync(path.join(d, 'a.txt'), '1');
  sh(d, 'git', ['add', '-A']);
  sh(d, 'git', ['commit', '-q', '-m', 'chore: base']);
  return d;
}
test('CLI msg mode: blocks fix without regression file, allows with exemption trailer', () => {
  const d = tmpRepo();
  fs.writeFileSync(path.join(d, 'b.txt'), '2');
  sh(d, 'git', ['add', '-A']);
  fs.writeFileSync(path.join(d, 'm1'), 'fix: x\n');
  assert.strictEqual(sh(d, 'node', [CLI, 'msg', path.join(d, 'm1')]).status, 1);
  fs.writeFileSync(path.join(d, 'm2'), 'fix: x\n\nRegression-Exempt: r\n');
  assert.strictEqual(sh(d, 'node', [CLI, 'msg', path.join(d, 'm2')]).status, 0);
  fs.rmSync(d, { recursive: true, force: true });
});
test('CLI pr mode: fix commit without test fails; fix/ branch and title env fail; non-fix passes', () => {
  const d = tmpRepo();
  fs.writeFileSync(path.join(d, 'b.txt'), '2');
  sh(d, 'git', ['add', '-A']);
  sh(d, 'git', ['commit', '-q', '-m', 'feat: y']);
  assert.strictEqual(sh(d, 'node', [CLI, 'pr', 'HEAD~1']).status, 0);
  assert.strictEqual(sh(d, 'node', [CLI, 'pr', 'HEAD~1'], { PR_HEAD_REF: 'fix/z' }).status, 1);
  assert.strictEqual(sh(d, 'node', [CLI, 'pr', 'HEAD~1'], { PR_TITLE: 'Fix login redirect' }).status, 1);
  fs.writeFileSync(path.join(d, 'c.txt'), '3');
  sh(d, 'git', ['add', '-A']);
  sh(d, 'git', ['commit', '-q', '-m', 'fix: z']);
  assert.strictEqual(sh(d, 'node', [CLI, 'pr', 'HEAD~1']).status, 1);
  fs.rmSync(d, { recursive: true, force: true });
});
test('CLI static mode (pre-commit): clean repo passes fast, undiscoverable backend .js file blocks', () => {
  const d = tmpRepo();
  const dir = path.join(d, 'backend/src/__tests__/regression');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'issue-1-a.test.ts'), "it('a', () => { expect(1).toBe(1); });");
  sh(d, 'git', ['add', '-A']);
  const t0 = Date.now();
  const ok1 = sh(d, 'node', [CLI, 'static']); // no node_modules exist in this repo: static mode must not need them
  assert.strictEqual(ok1.status, 0, ok1.stderr);
  assert.ok(Date.now() - t0 < 3000);
  fs.writeFileSync(path.join(dir, 'issue-2-b.test.js'), "it('a', () => { expect(1).toBe(1); });");
  sh(d, 'git', ['add', '-A']);
  assert.strictEqual(sh(d, 'node', [CLI, 'static']).status, 1);
  fs.rmSync(d, { recursive: true, force: true });
});
test('CLI static mode (pre-commit): banned file in the STAGED INDEX blocks even if the working tree is fixed', () => {
  const d = tmpRepo();
  const dir = path.join(d, 'backend/src/__tests__/regression');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'issue-1-a.test.ts');
  fs.writeFileSync(f, "it.skip('a', () => { expect(1).toBe(1); });");
  sh(d, 'git', ['add', '-A']);
  fs.writeFileSync(f, "it('a', () => { expect(1).toBe(1); });");
  const r = sh(d, 'node', [CLI, 'static']);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /banned/);
  fs.rmSync(d, { recursive: true, force: true });
});
