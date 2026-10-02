#!/usr/bin/env node
// Automated tests for pre-commit-quality-gate.js's three rules.
//
// Neither this hook nor its sibling pre-commit-gate.js had any prior
// automated test -- both were only ever verified manually, one-off, when
// first written. Added 2026-09-19 alongside Rule 3 (visual-regression) and
// Rule 2's fix(->feat( broadening, since a future edit to the shared
// detection regexes could silently break either rule with nothing to catch
// it before it reached every contributor's local `git commit`.
//
// Uses Node's built-in test runner (node:test) rather than Jest/Vitest,
// since this hook lives outside both the backend/ and frontend/ workspaces
// and has no test framework of its own -- avoids adding a new dependency
// just for this.
//
// Run: node --test .claude/hooks/__tests__/pre-commit-quality-gate.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK_PATH = path.join(__dirname, '..', 'pre-commit-quality-gate.js');

// Builds a minimal temp git repo the hook will recognize as expense-manager
// (it fails open otherwise), with a couple of real, git-tracked baseline
// files so "staging a change to X" is a genuine diff, not a no-op `git add`
// on an unmodified file.
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-gate-test-'));
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

  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# test repo\n');
  fs.mkdirSync(path.join(dir, 'frontend', 'src', 'screens'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'maestro-flows', 'visual'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'e2e'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'frontend', 'src', 'screens', 'HomeScreen.tsx'), 'export default function HomeScreen() {}\n');
  fs.writeFileSync(path.join(dir, 'maestro-flows', 'visual', 'group-list-screen.yaml'), 'appId: test\n');
  fs.writeFileSync(path.join(dir, 'e2e', 'existing.spec.ts'), '// placeholder\n');
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'chore: seed test repo']);

  return { dir, run };
}

function runHook(dir, commitMessage) {
  const input = JSON.stringify({
    tool_input: { command: `git -C ${dir} commit -m "${commitMessage.replace(/"/g, '\\"')}"` },
    cwd: dir,
  });
  const result = spawnSync('node', [HOOK_PATH], { input, encoding: 'utf8' });
  return { status: result.status, stderr: result.stderr };
}

test('passes cleanly when no screens/components file and no fix(/feat( message are involved', () => {
  const { dir, run } = makeRepo();
  fs.writeFileSync(path.join(dir, 'README.md'), 'hello\n');
  run(['add', 'README.md']);

  const result = runHook(dir, 'chore: update readme');
  assert.equal(result.status, 0);
});

test('Rule 1 + Rule 3 both block a screens/*.tsx change with no E2E/visual file and no exempt trailers', () => {
  const { dir, run } = makeRepo();
  fs.appendFileSync(path.join(dir, 'frontend', 'src', 'screens', 'HomeScreen.tsx'), '// change\n');
  run(['add', 'frontend/src/screens/HomeScreen.tsx']);

  const result = runHook(dir, 'chore: tweak home screen');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Rule 1: UI change needs real Playwright E2E/);
  assert.match(result.stderr, /Rule 3: UI change needs a visual-regression baseline/);
});

test('Rule 1 + Rule 3 both pass when both exempt trailers are present', () => {
  const { dir, run } = makeRepo();
  fs.appendFileSync(path.join(dir, 'frontend', 'src', 'screens', 'HomeScreen.tsx'), '// change\n');
  run(['add', 'frontend/src/screens/HomeScreen.tsx']);

  const result = runHook(
    dir,
    'chore: tweak home screen\n\nE2E-Exempt: cosmetic only\nVisual-Regression-Exempt: no emulator here'
  );
  assert.equal(result.status, 0);
});

test('Rule 3 passes (Rule 1 still needs its own exempt) when a real maestro-flows/visual/*.yaml change is staged alongside the screen change', () => {
  const { dir, run } = makeRepo();
  fs.appendFileSync(path.join(dir, 'frontend', 'src', 'screens', 'HomeScreen.tsx'), '// change\n');
  fs.appendFileSync(path.join(dir, 'maestro-flows', 'visual', 'group-list-screen.yaml'), '# updated baseline\n');
  run(['add', '-A']);

  const result = runHook(dir, 'chore: tweak home screen\n\nE2E-Exempt: covered by existing flow');
  assert.equal(result.status, 0);
});

test('Rule 1 blocks a screens/*.tsx change that only touches maestro-flows/ (no real e2e/ spec) with no E2E-Exempt trailer', () => {
  const { dir, run } = makeRepo();
  fs.appendFileSync(path.join(dir, 'frontend', 'src', 'screens', 'HomeScreen.tsx'), '// change\n');
  fs.appendFileSync(path.join(dir, 'maestro-flows', 'visual', 'group-list-screen.yaml'), '# updated baseline\n');
  run(['add', '-A']);

  const result = runHook(dir, 'chore: tweak home screen');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Rule 1: UI change needs real Playwright E2E/);
});

test('Rule 1 passes when a real e2e/*.spec.ts file is staged alongside the screen change, even with no maestro-flows/ change', () => {
  const { dir, run } = makeRepo();
  fs.appendFileSync(path.join(dir, 'frontend', 'src', 'screens', 'HomeScreen.tsx'), '// change\n');
  fs.appendFileSync(path.join(dir, 'e2e', 'existing.spec.ts'), '// updated spec\n');
  run(['add', '-A']);

  const result = runHook(dir, 'chore: tweak home screen\n\nVisual-Regression-Exempt: no emulator here');
  assert.equal(result.status, 0);
});

test('Rule 2 blocks a feat( commit with no test file staged', () => {
  const { dir, run } = makeRepo();
  fs.writeFileSync(path.join(dir, 'backend-logic.ts'), 'export const x = 1;\n');
  run(['add', 'backend-logic.ts']);

  const result = runHook(dir, 'feat(backend): add new logic');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Rule 2: fix\/feat needs a regression test/);
});

test('Rule 2 passes a feat( commit when a real test file is staged', () => {
  const { dir, run } = makeRepo();
  fs.mkdirSync(path.join(dir, 'backend', '__tests__'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'backend', '__tests__', 'logic.test.ts'), '// test\n');
  run(['add', '-A']);

  const result = runHook(dir, 'feat(backend): add new logic');
  assert.equal(result.status, 0);
});

test('Rule 2 still blocks a fix( commit with no test file staged (pre-existing behavior unchanged)', () => {
  const { dir, run } = makeRepo();
  fs.writeFileSync(path.join(dir, 'backend-logic.ts'), 'export const x = 1;\n');
  run(['add', 'backend-logic.ts']);

  const result = runHook(dir, 'fix(backend): correct off-by-one');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Rule 2: fix\/feat needs a regression test/);
});

test('a non-UI, non-fix/feat commit passes through all three rules even with real changes staged', () => {
  const { dir, run } = makeRepo();
  fs.writeFileSync(path.join(dir, 'docs-note.md'), 'notes\n');
  run(['add', 'docs-note.md']);

  const result = runHook(dir, 'docs: add a note');
  assert.equal(result.status, 0);
});
