#!/usr/bin/env node
// Automated tests for audit-pr-principles.js's rule logic. Mirrors the
// pattern used by .claude/hooks/__tests__/pre-commit-quality-gate.test.js:
// Node's built-in test runner, a real temp git repo, real commits.
//
// Run: node --test .claude/scripts/__tests__/audit-pr-principles.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { auditRange, evaluateCommit, formatSummary } = require('../audit-pr-principles');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'principles-audit-test-'));
  const run = (args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    }
    return result.stdout;
  };

  run(['init', '-q']);
  run(['config', 'user.email', 'test@test.com']);
  run(['config', 'user.name', 'Test']);

  fs.mkdirSync(path.join(dir, 'frontend', 'src', 'screens'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'backend', 'src', 'services'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'maestro-flows', 'visual'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'e2e'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'frontend', 'src', 'screens', 'HomeScreen.tsx'), 'export default function HomeScreen() {}\n');
  fs.writeFileSync(path.join(dir, 'backend', 'src', 'services', 'groupService.ts'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(dir, 'maestro-flows', 'visual', 'home-screen.yaml'), 'appId: test\n');
  fs.writeFileSync(path.join(dir, 'e2e', 'existing.spec.ts'), '// placeholder\n');
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'chore: seed test repo']);

  return { dir, run, commit: (msg) => run(['commit', '-q', '--allow-empty-message', '-m', msg]) };
}

function commitFileChange(repo, filePath, content, message) {
  fs.appendFileSync(path.join(repo.dir, filePath), content);
  repo.run(['add', filePath]);
  repo.commit(message);
}

test('a fix( commit touching backend source with no test and no trailer is a violation', () => {
  const repo = makeRepo();
  const base = repo.run(['rev-parse', 'HEAD']).trim();
  commitFileChange(repo, 'backend/src/services/groupService.ts', '// fix\n', 'fix(groups): correct bug');
  const head = repo.run(['rev-parse', 'HEAD']).trim();

  const result = auditRange(base, head, repo.dir);
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0].rule, /fix\/feat needs a regression test/);
  assert.equal(result.exemptions.length, 0);
});

test('a fix( commit with a Test-Exempt trailer is reported as an exemption, not a violation', () => {
  const repo = makeRepo();
  const base = repo.run(['rev-parse', 'HEAD']).trim();
  commitFileChange(
    repo,
    'backend/src/services/groupService.ts',
    '// fix\n',
    'fix(groups): correct bug\n\nTest-Exempt: covered by existing suite'
  );
  const head = repo.run(['rev-parse', 'HEAD']).trim();

  const result = auditRange(base, head, repo.dir);
  assert.equal(result.violations.length, 0);
  assert.equal(result.exemptions.length, 1);
  assert.equal(result.exemptions[0].rule, 'Test-Exempt');
  assert.equal(result.exemptions[0].reason, 'covered by existing suite');
});

test('a fix( commit touching backend source with a real test file staged is not a violation', () => {
  const repo = makeRepo();
  const base = repo.run(['rev-parse', 'HEAD']).trim();
  fs.mkdirSync(path.join(repo.dir, 'backend', 'src', 'services', '__tests__'), { recursive: true });
  fs.writeFileSync(path.join(repo.dir, 'backend', 'src', 'services', '__tests__', 'groupService.test.ts'), '// test\n');
  fs.appendFileSync(path.join(repo.dir, 'backend', 'src', 'services', 'groupService.ts'), '// fix\n');
  repo.run(['add', '-A']);
  repo.commit('fix(groups): correct bug');
  const head = repo.run(['rev-parse', 'HEAD']).trim();

  const result = auditRange(base, head, repo.dir);
  assert.equal(result.violations.length, 0);
});

test('a UI-touching commit with no visual baseline and no e2e file produces two violations', () => {
  const repo = makeRepo();
  const base = repo.run(['rev-parse', 'HEAD']).trim();
  commitFileChange(repo, 'frontend/src/screens/HomeScreen.tsx', '// change\n', 'chore: tweak home screen');
  const head = repo.run(['rev-parse', 'HEAD']).trim();

  const result = auditRange(base, head, repo.dir);
  assert.equal(result.violations.length, 2);
  const rules = result.violations.map((v) => v.rule).sort();
  assert.deepEqual(rules, ['UI change needs a visual-regression baseline', 'UI change needs real Playwright E2E'].sort());
});

test('a UI-touching commit with both exempt trailers produces zero violations and two exemptions', () => {
  const repo = makeRepo();
  const base = repo.run(['rev-parse', 'HEAD']).trim();
  commitFileChange(
    repo,
    'frontend/src/screens/HomeScreen.tsx',
    '// change\n',
    'chore: tweak home screen\n\nE2E-Exempt: cosmetic\nVisual-Regression-Exempt: no emulator'
  );
  const head = repo.run(['rev-parse', 'HEAD']).trim();

  const result = auditRange(base, head, repo.dir);
  assert.equal(result.violations.length, 0);
  assert.equal(result.exemptions.length, 2);
});

test('a UI-touching commit with real e2e/ and maestro-flows/visual/ files staged has zero violations', () => {
  const repo = makeRepo();
  const base = repo.run(['rev-parse', 'HEAD']).trim();
  fs.appendFileSync(path.join(repo.dir, 'frontend', 'src', 'screens', 'HomeScreen.tsx'), '// change\n');
  fs.appendFileSync(path.join(repo.dir, 'e2e', 'existing.spec.ts'), '// updated\n');
  fs.appendFileSync(path.join(repo.dir, 'maestro-flows', 'visual', 'home-screen.yaml'), '# updated\n');
  repo.run(['add', '-A']);
  repo.commit('chore: tweak home screen');
  const head = repo.run(['rev-parse', 'HEAD']).trim();

  const result = auditRange(base, head, repo.dir);
  assert.equal(result.violations.length, 0);
  assert.equal(result.exemptions.length, 0);
});

test('a multi-commit range aggregates violations and exemptions across every commit, not just the latest', () => {
  const repo = makeRepo();
  const base = repo.run(['rev-parse', 'HEAD']).trim();
  commitFileChange(repo, 'backend/src/services/groupService.ts', '// fix 1\n', 'fix(groups): first bug');
  commitFileChange(
    repo,
    'frontend/src/screens/HomeScreen.tsx',
    '// change\n',
    'feat(home): add widget\n\nTest-Exempt: trivial UI wiring\nE2E-Exempt: covered elsewhere\nVisual-Regression-Exempt: no emulator'
  );
  const head = repo.run(['rev-parse', 'HEAD']).trim();

  const result = auditRange(base, head, repo.dir);
  assert.equal(result.commits.length, 2);
  assert.equal(result.violations.length, 1); // only the first commit's fix( lacks a trailer/test
  assert.equal(result.exemptions.length, 3);
});

test('a non-UI, non-fix/feat commit produces no violations and no exemptions', () => {
  const repo = makeRepo();
  const base = repo.run(['rev-parse', 'HEAD']).trim();
  commitFileChange(repo, 'e2e/existing.spec.ts', '// noop change\n', 'docs: note');
  const head = repo.run(['rev-parse', 'HEAD']).trim();

  const result = auditRange(base, head, repo.dir);
  assert.equal(result.violations.length, 0);
  assert.equal(result.exemptions.length, 0);
});

test('formatSummary lists violations and exemptions by short sha and includes the ce-* disclaimer', () => {
  const commits = [{ sha: 'a'.repeat(40), message: '', files: [] }];
  const violations = [{ sha: 'a'.repeat(40), rule: 'UI change needs a visual-regression baseline', detail: 'x' }];
  const exemptions = [{ sha: 'b'.repeat(40), rule: 'Test-Exempt', reason: 'reason here' }];

  const summary = formatSummary({ commits, violations, exemptions });
  assert.match(summary, /1 unexempted violation/);
  assert.match(summary, /aaaaaaa/);
  assert.match(summary, /1 exempt trailer/);
  assert.match(summary, /bbbbbbb/);
  assert.match(summary, /reason here/);
  assert.match(summary, /does not and cannot check whether/);
});

test('evaluateCommit ignores non-source files under backend\\/ and frontend\\/ for the fix\\/feat-needs-test rule', () => {
  const commit = {
    sha: 'c'.repeat(40),
    message: 'fix(docs): typo',
    files: ['backend/README.md', 'frontend/package.json'],
  };
  const { violations } = evaluateCommit(commit);
  assert.equal(violations.length, 0);
});
