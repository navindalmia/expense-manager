'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveNotesBase, NotesBaseError } = require('../resolve-notes-base');

const yes = () => true;
const HEAD = 'h'.repeat(40);

test('since override wins over tags and before', () => {
  const tags = [{ name: 'staging-20261101-aaaaaaa', sha: 'a1', time: 5 }];
  assert.equal(resolveNotesBase({ since: ' v1 ', before: 'b1', head: HEAD, tags, isAncestor: yes }), 'v1');
  assert.equal(resolveNotesBase({ since: 'v1', head: HEAD, tags, isAncestor: yes, verify: (r) => `sha-of-${r}` }), 'sha-of-v1');
});

test('uses the newest staging tag that is an ancestor of head', () => {
  const tags = [
    { name: 'staging-20261030-aaaaaaa', sha: 'old', time: 1 },
    { name: 'staging-20261101-bbbbbbb', sha: 'new', time: 9 },
  ];
  assert.equal(resolveNotesBase({ before: 'b1', head: HEAD, tags, isAncestor: yes }), 'new');
});

test('skips tags that are not ancestors, point at head, or are not staging tags', () => {
  const tags = [
    { name: 'staging-20261101-ccccccc', sha: 'diverged', time: 9 },
    { name: 'staging-20261101-ddddddd', sha: HEAD, time: 8 },
    { name: 'v1.2.3', sha: 'other', time: 7 },
    { name: 'staging-20261030-aaaaaaa', sha: 'good', time: 1 },
  ];
  const isAncestor = (sha) => sha !== 'diverged';
  assert.equal(resolveNotesBase({ before: 'b1', head: HEAD, tags, isAncestor }), 'good');
});

test('falls back to before when no usable tag exists', () => {
  assert.equal(resolveNotesBase({ before: 'b1', head: HEAD, tags: [], isAncestor: yes }), 'b1');
});

test('returns empty for a null before sha with no tags', () => {
  assert.equal(resolveNotesBase({ before: '0000000000000000000000000000000000000000', head: HEAD, tags: [], isAncestor: yes }), '');
  assert.equal(resolveNotesBase({ head: HEAD, tags: [], isAncestor: yes }), '');
});

test('since starting with a dash is rejected', () => {
  assert.throws(() => resolveNotesBase({ since: '--output=/x', head: HEAD, isAncestor: yes }), NotesBaseError);
});

test('since that does not resolve is an error, not a fallback', () => {
  assert.throws(() => resolveNotesBase({ since: 'nope', before: 'b1', head: HEAD, tags: [], isAncestor: yes, verify: () => null }), /does not resolve/);
});

test('an event.before that no longer exists is an error when no tag exists', () => {
  assert.throws(() => resolveNotesBase({ before: 'gone', head: HEAD, tags: [], isAncestor: yes, verify: () => null }), /force-push/);
});

test('a usable tag wins even when event.before is gone', () => {
  const tags = [{ name: 'staging-20261101-bbbbbbb', sha: 'new', time: 9 }];
  assert.equal(resolveNotesBase({ before: 'gone', head: HEAD, tags, isAncestor: yes, verify: () => null }), 'new');
});

// ---- CLI against a real temporary git repository
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPTS = path.resolve(__dirname, '..');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-base-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env }).trim();
  git('init', '-q', '-b', 'staging');
  fs.mkdirSync(path.join(dir, 'frontend'));
  fs.writeFileSync(path.join(dir, 'frontend/app.config.js'), '{\n  "version": "2.3.4",\n}\n');
  let n = 0;
  const commit = (msg) => {
    n += 1;
    fs.writeFileSync(path.join(dir, `f${n}.txt`), msg);
    git('add', '-A');
    git('commit', '-q', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  return { dir, git, commit };
}

function run(script, args, cwd, env = {}) {
  return spawnSync('node', [path.join(SCRIPTS, script), ...args], { cwd, encoding: 'utf8', env: { ...process.env, GH_TOKEN: '', ...env } });
}

test('CLI picks the newest staging tag that is an ancestor of head', () => {
  const { dir, git, commit } = makeRepo();
  const first = commit('feat: first real change (#1)');
  git('tag', `staging-20261030-${first.slice(0, 7)}`);
  const second = commit('fix: second real change (#2)');
  git('tag', `staging-20261031-${second.slice(0, 7)}`);
  commit('fix: third real change (#3)');
  const out = run('resolve-notes-base.js', ['--before', first, '--head', 'HEAD'], dir);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout.trim(), second);
});

test('CLI falls back to --before, honours --since, and fails loudly on bad input', () => {
  const { dir, commit } = makeRepo();
  const first = commit('feat: first real change (#1)');
  commit('fix: second real change (#2)');
  assert.equal(run('resolve-notes-base.js', ['--before', first, '--head', 'HEAD'], dir).stdout.trim(), first);
  assert.equal(run('resolve-notes-base.js', ['--since', first, '--before', '', '--head', 'HEAD'], dir).stdout.trim(), first);
  const bad = run('resolve-notes-base.js', ['--since', 'no-such-ref', '--head', 'HEAD'], dir);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /::error::since does not resolve/);
  const dash = run('resolve-notes-base.js', ['--since', '--output=/tmp/x', '--head', 'HEAD'], dir);
  assert.equal(dash.status, 1);
  assert.match(dash.stderr, /::error::/);
  const gone = run('resolve-notes-base.js', ['--before', 'f'.repeat(40), '--head', 'HEAD'], dir);
  assert.equal(gone.status, 1);
  assert.match(gone.stderr, /::error::/);
});

test('--template CLI covers every commit since the base, reads PR notes via gh and never says tester', () => {
  const { dir, git, commit } = makeRepo();
  const base = commit('chore: seed the repository for tests');
  git('tag', `staging-20261030-${base.slice(0, 7)}`);
  commit('fix(frontend): restore theme picker focus (#150)');
  commit('feat: add staging banner for testers (#148)');
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-gh-'));
  fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\nprintf "## Tester notes\\nAsk the tester to open Themes\\n"\n', { mode: 0o755 });
  const out = run('eas-release-notes.js', ['--template', base, 'HEAD'], dir, {
    GH_TOKEN: 'x', GITHUB_REPOSITORY: 'o/r', PATH: `${bin}${path.delimiter}${process.env.PATH}`, BUILD_KIND: 'native', UPDATE_GROUP: 'grp-42',
  });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^# Expense Manager 2\.3\.4 \(staging\) - \d{4}-\d{2}-\d{2}/);
  assert.match(out.stdout, /Restore theme picker focus/);
  assert.match(out.stdout, /Add staging banner for users/);
  assert.match(out.stdout, /## What to check\n- \[#148\][^\n]*: Ask the user to open Themes\n- \[#150\]/);
  assert.match(out.stdout, /OTA update plus a new native build/);
  assert.match(out.stdout, /EAS update group: grp-42/);
  assert.match(out.stdout, /Previous release\n- staging-20261030-/);
  assert.doesNotMatch(out.stdout, /tester/i);
});

test('notes CLI exits 1 with ::error:: for an unreadable range instead of generic notes', () => {
  const { dir, commit } = makeRepo();
  commit('feat: first real change (#1)');
  for (const flags of [[], ['--template'], ['--list']]) {
    const out = run('eas-release-notes.js', [...flags, 'f'.repeat(40), 'HEAD'], dir);
    assert.equal(out.status, 1, flags.join(' '));
    assert.match(out.stderr, /::error::cannot read commits/);
    assert.equal(out.stdout, '');
  }
});

test('notes CLI --update-group prints the group id', () => {
  const { dir } = makeRepo();
  const file = path.join(dir, 'u.json');
  fs.writeFileSync(file, '[{"group":"g-77"}]');
  assert.equal(run('eas-release-notes.js', ['--update-group', file], dir).stdout.trim(), 'g-77');
});
