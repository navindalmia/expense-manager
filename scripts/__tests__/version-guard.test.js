'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { touchesAppCode, parseVersion, compareVersions, extractAppVersion, evaluateVersion } = require('../version-guard');

const ok = (base, head, pkg = head) => evaluateVersion({ baseVersion: base, headVersion: head, headPackageVersion: pkg });

test('a MINOR bump is allowed', () => assert.equal(ok('1.0.0', '1.1.0').ok, true));
test('a PATCH bump is allowed', () => assert.equal(ok('1.1.0', '1.1.1').ok, true));
test('a MAJOR bump is allowed', () => assert.equal(ok('1.9.9', '2.0.0').ok, true));
test('an unchanged version is blocked', () => {
  const r = ok('1.0.0', '1.0.0');
  assert.equal(r.ok, false);
  assert.match(r.reason, /not bumped/);
});
test('a lower version is blocked', () => assert.equal(ok('1.2.0', '1.1.9').ok, false));
test('numeric, not string, comparison: 1.10.0 is above 1.9.0', () => assert.equal(ok('1.9.0', '1.10.0').ok, true));
test('package.json out of sync is blocked', () => {
  const r = ok('1.0.0', '1.1.0', '1.0.0');
  assert.equal(r.ok, false);
  assert.match(r.reason, /package\.json/);
});
test('a malformed or missing version is blocked', () => {
  assert.equal(ok('1.0.0', '1.1').ok, false);
  assert.equal(ok(null, '1.1.0').ok, false);
  assert.equal(ok('1.0.0', null).ok, false);
});
test('parseVersion and compareVersions', () => {
  assert.deepEqual(parseVersion('1.2.3'), [1, 2, 3]);
  assert.equal(parseVersion('v1.2.3'), null);
  assert.equal(compareVersions([1, 0, 0], [1, 0, 1]), -1);
});
test('extractAppVersion reads app.config.js and app.json', () => {
  assert.equal(extractAppVersion('frontend/app.config.js', 'const x = {\n  "version": "1.4.0",\n}'), '1.4.0');
  assert.equal(extractAppVersion('frontend/app.json', JSON.stringify({ expo: { version: '1.0.0' } })), '1.0.0');
  assert.equal(extractAppVersion('frontend/app.json', 'not json'), null);
});

test('app code changes need a bump; docs, CI and test-only changes do not', () => {
  assert.equal(touchesAppCode(['frontend/src/screens/AboutScreen.tsx']), true);
  assert.equal(touchesAppCode(['backend/src/services/groupService.ts']), true);
  assert.equal(touchesAppCode(['frontend/src/components/__tests__/EditGroupModal.test.tsx', 'README.md', '.github/workflows/ci.yml', 'maestro-flows/visual/x.yaml']), false);
  const unchanged = { baseVersion: '1.0.0', headVersion: '1.0.0', headPackageVersion: '1.0.0' };
  assert.equal(evaluateVersion({ ...unchanged, changedFiles: ['docs/x.md'] }).ok, true);
  assert.equal(evaluateVersion({ ...unchanged, changedFiles: ['frontend/src/a.ts'] }).ok, false);
});
