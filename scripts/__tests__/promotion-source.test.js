'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');
const { evaluatePromotion, parseLabels } = require('../promotion-source');

const R = 'owner/repo';

test('PR from staging into master is allowed', () => {
  assert.equal(evaluatePromotion('master', 'staging', [], R, R).ok, true);
});

test('feature branch into master is blocked', () => {
  const r = evaluatePromotion('master', 'feat/x', [], R, R);
  assert.equal(r.ok, false);
  assert.match(r.reason, /staging/);
});

test('feature branch into master with hotfix label is allowed', () => {
  assert.equal(evaluatePromotion('master', 'fix/urgent', ['hotfix'], R, R).ok, true);
});

test('unrelated label does not unlock master', () => {
  assert.equal(evaluatePromotion('master', 'feat/x', ['bug'], R, R).ok, false);
});

test('PRs into other bases are not applicable', () => {
  assert.equal(evaluatePromotion('staging', 'feat/x', [], R, R).ok, true);
});

test('parseLabels tolerates empty and malformed input', () => {
  assert.deepEqual(parseLabels(''), []);
  assert.deepEqual(parseLabels('not json'), []);
  assert.deepEqual(parseLabels('{"a":1}'), []);
  assert.deepEqual(parseLabels('["hotfix",3]'), ['hotfix']);
});

test('CLI exits 1 when blocked and 0 when allowed', () => {
  const script = path.join(__dirname, '..', 'promotion-source.js');
  const blocked = spawnSync('node', [script, 'master', 'feat/x', '[]', R, R]);
  assert.equal(blocked.status, 1);
  const out = execFileSync('node', [script, 'master', 'staging', '[]', R, R], { encoding: 'utf8' });
  assert.match(out, /^OK/);
});

test('fork PR from a branch named staging is rejected', () => {
  const r = evaluatePromotion('master', 'staging', [], 'attacker/repo', R);
  assert.equal(r.ok, false);
  assert.match(r.reason, /fork/);
});

test('fork PR is rejected even with the hotfix label', () => {
  assert.equal(evaluatePromotion('master', 'x', ['hotfix'], 'attacker/repo', R).ok, false);
});

test('missing repo info fails closed', () => {
  assert.equal(evaluatePromotion('master', 'staging', []).ok, false);
});
