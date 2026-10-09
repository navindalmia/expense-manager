#!/usr/bin/env node
// Guards the hook wiring itself, not just the hook scripts.
//
// Regression: the PreToolUse commit gates were registered with
// `matcher: "Bash(git commit*)"`. `matcher` only filters on the TOOL NAME; any
// value containing characters other than letters, digits, `_`, `-`, `,`, `|` or
// spaces is treated as a regex over that name, and `Bash(git commit*)` can never
// match the tool "Bash". So pre-commit-gate.js and pre-commit-quality-gate.js
// never ran at all, for any commit, while their own unit tests stayed green.
// Command-level filtering belongs in the hook's `if` field (permission-rule
// syntax) or in the script.
//
// Run: node --test .claude/hooks/__tests__/hook-config.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { isGitCommit } = require('../lib/is-git-commit');

const SETTINGS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'settings.json'), 'utf8'));
const SIMPLE_MATCHER = /^[A-Za-z0-9_|, -]*$/;

test('every hook matcher is a plain tool-name list, never a permission-rule pattern', () => {
  for (const [event, entries] of Object.entries(SETTINGS.hooks || {})) {
    for (const entry of entries) {
      if (entry.matcher === undefined) continue;
      assert.match(entry.matcher, SIMPLE_MATCHER, `${event} matcher "${entry.matcher}" would be read as a regex over the tool name`);
    }
  }
});

test('the commit gates are registered on the Bash tool (they filter for git commit themselves)', () => {
  const commands = SETTINGS.hooks.PreToolUse.filter((e) => e.matcher === 'Bash').flatMap((e) => e.hooks);
  for (const script of ['pre-commit-gate.js', 'pre-commit-quality-gate.js']) {
    assert.ok(commands.find((h) => h.command.includes(script)), `${script} must be registered under the Bash matcher`);
  }
});

test('isGitCommit detects commits in plain, compound and -C forms', () => {
  assert.equal(isGitCommit('git commit -m "x"'), true);
  assert.equal(isGitCommit('cd /repo && git add -A && git commit -q -F - <<EOF\nmsg\nEOF'), true);
  assert.equal(isGitCommit('git -C /path/to/repo commit -m x'), true);
  assert.equal(isGitCommit('git -c user.name=a commit -m x'), true);
  assert.equal(isGitCommit('FOO=1 git commit --amend'), true);
  assert.equal(isGitCommit('git -C "/path with spaces/repo" commit -m x'), true);
  assert.equal(isGitCommit("git -c user.name='A B' commit -m x"), true);
  assert.equal(isGitCommit('git --git-dir /x/.git commit -m x'), true);
  assert.equal(isGitCommit('git -p commit -m x'), true);
  assert.equal(isGitCommit('/usr/bin/git commit -m x'), true);
  assert.equal(isGitCommit('(git commit -m x)'), true);
  assert.equal(isGitCommit('bash -c "git commit -m x"'), true);
});

test('isGitCommit ignores other git and non-git commands', () => {
  assert.equal(isGitCommit('git status'), false);
  assert.equal(isGitCommit('git log --grep=commit'), false);
  assert.equal(isGitCommit('git commit-tree abc'), false);
  assert.equal(isGitCommit('npm run commit-lint'), false);
  assert.equal(isGitCommit('git log -- commit.txt'), false);
  assert.equal(isGitCommit(undefined), false);
});

test('the gate scripts exit 0 immediately for a non-commit Bash command', () => {
  for (const script of ['pre-commit-gate.js', 'pre-commit-quality-gate.js']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, '..', script)], {
      input: JSON.stringify({ tool_input: { command: 'git status' }, cwd: os.tmpdir() }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
  }
});

// A temp repo that looks like expense-manager, with one non-test file staged.
function makeRepoWithStagedFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-config-test-'));
  const run = (args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  run(['init', '-q']);
  run(['config', 'user.email', 't@t']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'x');
  fs.writeFileSync(path.join(dir, 'a.js'), '1');
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'base']);
  fs.writeFileSync(path.join(dir, 'a.js'), '2');
  run(['add', '-A']);
  return dir;
}

function runGate(script, command, cwd) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', script)], {
    input: JSON.stringify({ tool_input: { command }, cwd }),
    encoding: 'utf8',
  });
}

test('a commit command actually reaches the gate logic and is blocked (fix( with no test staged)', () => {
  const repo = makeRepoWithStagedFile();
  const plain = runGate('pre-commit-quality-gate.js', 'git commit -m "fix(x): y"', repo);
  assert.equal(plain.status, 2, plain.stderr);
  const compound = runGate('pre-commit-quality-gate.js', `cd ${repo} && git commit -m "fix(x): y"`, repo);
  assert.equal(compound.status, 2, compound.stderr);
  const quotedC = runGate('pre-commit-quality-gate.js', `git -C "${repo}" commit -m "fix(x): y"`, os.tmpdir());
  assert.equal(quotedC.status, 2, quotedC.stderr);
});

test('the same staged state does not block a non-commit command', () => {
  const repo = makeRepoWithStagedFile();
  assert.equal(runGate('pre-commit-quality-gate.js', 'git status', repo).status, 0);
});
