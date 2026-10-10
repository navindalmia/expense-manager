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

// --- P0-A / P0-B regressions: target-repo resolution and commit-segment scanning ---

function makeEmptyOtherRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-other-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'x');
  return dir;
}

test('leading `cd <repo> &&` selects the target repo, not the hook cwd', () => {
  const staged = makeRepoWithStagedFile(); // fix( with no test staged -> blocked if judged here
  const elsewhere = makeEmptyOtherRepo(); // hook cwd: empty staged list
  const viaCd = runGate('pre-commit-quality-gate.js', `cd ${staged} && git commit -m "fix(x): y"`, elsewhere);
  assert.equal(viaCd.status, 2, viaCd.stderr);
  const viaPushd = runGate('pre-commit-quality-gate.js', `pushd "${staged}" && git commit -m "fix(x): y"`, elsewhere);
  assert.equal(viaPushd.status, 2, viaPushd.stderr);
});

test('`cd <other repo> &&` commit is judged against that repo, not the hook cwd', () => {
  const staged = makeRepoWithStagedFile();
  const other = makeEmptyOtherRepo();
  fs.writeFileSync(path.join(other, 'a.test.ts'), 't');
  spawnSync('git', ['add', '-A'], { cwd: other });
  // hook cwd repo has only a non-test file staged (would block); target repo stages a test -> allowed
  const res = runGate('pre-commit-quality-gate.js', `cd ${other} && git commit -m "fix(x): y"`, staged);
  assert.equal(res.status, 0, res.stderr);
});

test('quoted `-C "path with spaces"` resolves the full path', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'hook sp ace-'));
  const repo = makeRepoWithStagedFile();
  const spaced = path.join(parent, 'my repo');
  fs.renameSync(repo, spaced);
  const res = runGate('pre-commit-quality-gate.js', `git -C "${spaced}" commit -m "fix(x): y"`, os.tmpdir());
  assert.equal(res.status, 2, res.stderr);
});

test('-m text mentioned in an earlier heredoc/script segment is not the commit message', () => {
  const repo = makeRepoWithStagedFile();
  const cmd = `python3 - <<'PY'\nprint('git commit -m "fix(x): probe"')\nPY\ngit -C ${repo} commit -m "docs: y"`;
  assert.equal(runGate('pre-commit-quality-gate.js', cmd, repo).status, 0);
  const echoed = `echo 'run: git commit -m "fix(x): y"' && git -C ${repo} commit -m "docs: y"`;
  assert.equal(runGate('pre-commit-quality-gate.js', echoed, repo).status, 0);
});

test('a real fix( commit in a later segment is still blocked', () => {
  const repo = makeRepoWithStagedFile();
  const res = runGate('pre-commit-quality-gate.js', `echo hi; git -C ${repo} commit -m "fix(x): y"`, repo);
  assert.equal(res.status, 2, res.stderr);
});

test('commit-context helpers split on unquoted separators only', () => {
  const { splitSegments, extractCommitMessage, resolveTargetDir } = require('../lib/commit-context');
  assert.deepEqual(splitSegments('a && b; c | d || e\nf'), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(splitSegments('echo "a && b" && git commit'), ['echo "a && b"', 'git commit']);
  assert.equal(extractCommitMessage('echo "-m x" && git commit -m "docs: a" -m \'b\''), 'docs: a\n\nb');
  assert.equal(resolveTargetDir({ tool_input: { command: 'cd /x/y && git commit -m a' }, cwd: '/z' }), '/x/y');
  assert.equal(resolveTargetDir({ tool_input: { command: 'git commit -m a' }, cwd: '/z' }), '/z');
});

// --- review follow-ups: message forms, prefixes, -C placement, subshell cd ---

test('extractCommitMessage handles heredoc $(cat), --message and combined short flags', () => {
  const { extractCommitMessage } = require('../lib/commit-context');
  const heredoc = 'git commit -m "$(cat <<\'EOF\'\nfix(x): y\n\nbody\nEOF\n)"';
  assert.equal(extractCommitMessage(heredoc), 'fix(x): y\n\nbody');
  assert.equal(extractCommitMessage('git commit --message="fix(x): y"'), 'fix(x): y');
  assert.equal(extractCommitMessage('git commit --message "fix(x): y"'), 'fix(x): y');
  for (const flag of ['-am', '-qm', '-sm', '-nm']) {
    assert.equal(extractCommitMessage(`git commit ${flag} "fix(x): y"`), 'fix(x): y', flag);
  }
});

test('commit segment is found behind sudo, env and quoted env assignments', () => {
  const { extractCommitMessage } = require('../lib/commit-context');
  for (const prefix of ['sudo ', 'env ', 'env -i FOO=1 ', 'FOO="a b" ', "FOO='a b' BAR=1 "]) {
    assert.equal(extractCommitMessage(`${prefix}git commit -m "fix(x): y"`), 'fix(x): y', prefix);
  }
});

test('-C is honoured only between git and commit', () => {
  const { resolveTargetDir } = require('../lib/commit-context');
  const at = (command) => resolveTargetDir({ tool_input: { command }, cwd: '/z' });
  assert.equal(at('git -C "/a b" commit -m x'), '/a b');
  assert.equal(at('git -C /a -c user.name=n commit -m x'), '/a');
  assert.equal(at('git commit -m "see git -C /evil here"'), '/z');
  assert.equal(at('git commit -C /evil'), '/z');
});

test('subshell and brace-group cd are honoured', () => {
  const { resolveTargetDir } = require('../lib/commit-context');
  const at = (command) => resolveTargetDir({ tool_input: { command }, cwd: '/z' });
  assert.equal(at('(cd /b; git commit -m x)'), '/b');
  assert.equal(at('{ cd /b; git commit -m x; }'), '/b');
  assert.equal(at('(cd /b && git commit -m x)'), '/b');
});

test('gate blocks a heredoc-message fix( commit', () => {
  const repo = makeRepoWithStagedFile();
  const cmd = `git -C ${repo} commit -m "$(cat <<'EOF'\nfix(x): y\nEOF\n)"`;
  assert.equal(runGate('pre-commit-quality-gate.js', cmd, repo).status, 2);
});
