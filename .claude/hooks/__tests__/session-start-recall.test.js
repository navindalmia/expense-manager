#!/usr/bin/env node
// Tests for session-start-recall.js: newest NN- handoff selection, filename
// filtering, recursive docs/solutions count, and silent exits.
//
// Same runner as the sibling hook tests (node:test, no new dependency).
// Run: node --test .claude/hooks/__tests__/session-start-recall.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOK_PATH = path.join(__dirname, '..', 'session-start-recall.js');

// Temp HOME (with the pinned memory folder layout) + temp project dir.
function makeEnv({ handoffs = [], solutions = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-hook-test-'));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  const parts = path.join(home, '.claude', 'projects', 'C--nd-repos-expense-manager', 'memory', 'project_context');
  fs.mkdirSync(project, { recursive: true });
  if (handoffs.length > 0) fs.mkdirSync(parts, { recursive: true });
  for (const name of handoffs) fs.writeFileSync(path.join(parts, name), 'x');
  for (const rel of solutions) {
    const file = path.join(project, 'docs', 'solutions', rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x');
  }
  return { home, project };
}

function runHook({ home, project }) {
  return spawnSync(process.execPath, [HOOK_PATH], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_PROJECT_DIR: project },
  });
}

test('picks the numerically newest NN- handoff, so 10- outranks 9-', () => {
  const env = makeEnv({ handoffs: ['9-old.md', '10-newer.md', '2-oldest.md'] });
  const result = runHook(env);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /10-newer\.md/);
  assert.doesNotMatch(result.stdout, /9-old\.md/);
});

test('ignores non-md, non-numeric and date-prefixed names', () => {
  const env = makeEnv({ handoffs: ['03-real.md', 'notes.md', '2026-10-09-diary.md', '04-draft.txt'] });
  const result = runHook(env);
  assert.match(result.stdout, /03-real\.md/);
  assert.doesNotMatch(result.stdout, /2026-10-09-diary|notes\.md|04-draft/);
});

test('counts docs/solutions markdown files recursively', () => {
  const env = makeEnv({ solutions: ['a/one.md', 'a/b/two.md', 'three.md', 'a/ignore.txt'] });
  const result = runHook(env);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /holds 3 documented fixes/);
});

test('prints only the section it has data for', () => {
  const onlyHandoff = runHook(makeEnv({ handoffs: ['01-a.md'] }));
  assert.match(onlyHandoff.stdout, /Latest handoff note/);
  assert.doesNotMatch(onlyHandoff.stdout, /docs\/solutions\/ holds/);

  const onlySolutions = runHook(makeEnv({ solutions: ['x.md'] }));
  assert.match(onlySolutions.stdout, /docs\/solutions\/ holds 1 documented fixes/);
  assert.doesNotMatch(onlySolutions.stdout, /Latest handoff note/);
});

test('exits 0 and prints nothing when the memory folder and docs/solutions are missing', () => {
  const result = runHook(makeEnv());
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});
