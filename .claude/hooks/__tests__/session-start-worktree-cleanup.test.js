#!/usr/bin/env node
// Tests for session-start-worktree-cleanup.js decision logic
// (shouldRemove, hasIrreplaceableIgnored).
// Run: node --test .claude/hooks/__tests__/session-start-worktree-cleanup.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { shouldRemove, hasIrreplaceableIgnored } = require('../session-start-worktree-cleanup.js');

const mainRoot = '/repo';
const base = {
  worktreePath: path.join(mainRoot, '.claude', 'worktrees', 'feat-x'),
  mainRoot,
  currentRoot: mainRoot,
  branch: 'feat/x',
  status: '',
  mergedHeadSha: 'abc123',
  localHeadSha: 'abc123',
};

test('should remove a clean worktree whose merged PR head equals local HEAD', () => {
  assert.equal(shouldRemove(base), true);
});

test('should remove a worktree whose only ignored files are regenerable build output', () => {
  assert.equal(shouldRemove({ ...base, status: '!! backend/node_modules/\n!! frontend/.expo/' }), true);
});

test('should keep a worktree with uncommitted or untracked files', () => {
  assert.equal(shouldRemove({ ...base, status: '?? notes.md' }), false);
  assert.equal(shouldRemove({ ...base, status: ' M src/a.ts' }), false);
});

test('should keep a worktree holding an ignored env file', () => {
  assert.equal(shouldRemove({ ...base, status: '!! backend/.env.local' }), false);
});

test('should keep a worktree when git status could not be read', () => {
  assert.equal(shouldRemove({ ...base, status: null }), false);
});

test('should keep a worktree with local commits beyond the merged PR head', () => {
  assert.equal(shouldRemove({ ...base, localHeadSha: 'def456' }), false);
});

test('should keep a worktree whose branch has no merged PR', () => {
  assert.equal(shouldRemove({ ...base, mergedHeadSha: '' }), false);
});

test('should keep a detached-HEAD worktree', () => {
  assert.equal(shouldRemove({ ...base, branch: '' }), false);
});

test('should keep worktrees outside the main checkout .claude/worktrees', () => {
  assert.equal(shouldRemove({ ...base, worktreePath: '/elsewhere/feat-x' }), false);
});

test('should keep the worktree the session is running in', () => {
  assert.equal(shouldRemove({ ...base, currentRoot: base.worktreePath }), false);
});

test('should treat only non-regenerable ignored paths as irreplaceable', () => {
  assert.equal(hasIrreplaceableIgnored('!! node_modules/'), false);
  assert.equal(hasIrreplaceableIgnored('!! a/b/node_modules/x'), false);
  assert.equal(hasIrreplaceableIgnored('!! .env'), true);
  assert.equal(hasIrreplaceableIgnored(''), false);
});
