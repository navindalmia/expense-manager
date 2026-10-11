'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReleaseNotes, cleanSubject } = require('../eas-release-notes');

test('cleanSubject strips the conventional prefix and PR suffix', () => {
  assert.equal(cleanSubject('feat(frontend): add Manage Themes screen (#91)'), 'add Manage Themes screen');
});

test('buildReleaseNotes joins meaningful subjects, capitalised', () => {
  const notes = buildReleaseNotes([
    'fix(frontend): keep picker search above the keyboard (#88)',
    'feat: add Manage Themes screen (#91)',
  ]);
  assert.equal(notes, 'Keep picker search above the keyboard; Add Manage Themes screen');
});

test('buildReleaseNotes falls back when subjects are terse', () => {
  assert.equal(buildReleaseNotes(['wip', 'fix', 'update']), 'Bug fixes and improvements');
});

test('buildReleaseNotes falls back when there are no commits', () => {
  assert.equal(buildReleaseNotes([]), 'Bug fixes and improvements');
});

test('buildReleaseNotes ignores merge commits', () => {
  assert.equal(buildReleaseNotes(['Merge branch master into feature']), 'Bug fixes and improvements');
});

test('buildReleaseNotes truncates very long summaries', () => {
  const long = Array.from({ length: 20 }, (_, i) => `feat: a reasonably long change description number ${i}`);
  const notes = buildReleaseNotes(long);
  assert.ok(notes.length <= 200);
  assert.ok(notes.endsWith('...'));
});
