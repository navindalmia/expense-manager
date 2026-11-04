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
  assert.match(notes, / \(\+\d+ more\)$/);
});

test('buildReleaseNotes keeps whole items and counts the dropped ones on overflow', () => {
  const long = Array.from({ length: 20 }, (_, i) => `feat: a reasonably long change description number ${String(i).padStart(2, '0')}`);
  const notes = buildReleaseNotes(long);
  const m = notes.match(/^(.*) \(\+(\d+) more\)$/);
  assert.ok(m);
  const items = m[1].split('; ');
  assert.equal(items.length + Number(m[2]), 20);
  for (const item of items) {
    assert.match(item, /^A reasonably long change description number \d\d$/);
  }
});

test('buildReleaseNotes covers a multi-PR range, newest first as git log gives it', () => {
  const notes = buildReleaseNotes([
    'fix(frontend): restore theme picker focus (#150)',
    'feat: add staging banner to the home screen (#148)',
    'fix(backend): honour selected payer when creating an expense (#99)',
  ]);
  assert.equal(
    notes,
    'Restore theme picker focus; Add staging banner to the home screen; Honour selected payer when creating an expense',
  );
});

test('cleanSubject strips a PR number leaking inside the text', () => {
  assert.equal(cleanSubject('fix: revert broken picker from (#144) properly (#150)'), 'revert broken picker from properly');
});

test('buildReleaseNotes de-duplicates identical notes', () => {
  const notes = buildReleaseNotes([
    'fix: keep picker search above keyboard (#1)',
    'fix(frontend): keep picker search above keyboard (#2)',
  ]);
  assert.equal(notes, 'Keep picker search above keyboard');
});

test('buildReleaseNotes falls back when every subject is dropped', () => {
  assert.equal(buildReleaseNotes(['wip', 'Merge branch x', '']), 'Bug fixes and improvements');
});

test('buildReleaseNotesList renders markdown bullets and skips terse subjects', () => {
  const { buildReleaseNotesList } = require('../eas-release-notes');
  const out = buildReleaseNotesList(['feat(x): add staging banner (#1)', 'wip', 'Merge branch a']);
  assert.equal(out, '- Add staging banner');
});

test('buildReleaseNotesList falls back when nothing is meaningful', () => {
  const { buildReleaseNotesList } = require('../eas-release-notes');
  assert.equal(buildReleaseNotesList(['wip']), '- Bug fixes and improvements');
});

const { buildReleaseTemplate, extractCheckNotes, fetchCheckNotes, parseUpdateGroup, scrub } = require('../eas-release-notes');

const META = {
  appVersion: '1.0.0', runtimeVersion: '1.0.0', sha: 'abc1234', branch: 'staging', buildKind: 'ota',
  updateGroup: 'grp-1', date: '2026-11-01', repo: 'o/r', previousTag: 'staging-20261030-def5678',
  previousDate: '2026-10-30', knownIssues: '- Picker flickers on Android 9', checkNotes: { 150: 'Open Themes, pick one' },
};

test('template groups by type, links PRs and fills every section', () => {
  const out = buildReleaseTemplate([
    'fix(frontend): restore theme picker focus (#150)',
    'feat: add staging banner to the home screen (#148)',
    'chore(ci): tidy the workflow caching setup (#149)',
  ], META);
  assert.match(out, /^# Expense Manager 1\.0\.0 \(staging\) - 2026-11-01/);
  assert.match(out, /- Commit: abc1234 \(staging\)/);
  assert.match(out, /- Delivery: OTA update/);
  assert.match(out, /- EAS update group: grp-1/);
  assert.match(out, /## What's new\n- Add staging banner to the home screen \(\[#148\]\(https:\/\/github\.com\/o\/r\/pull\/148\)\)/);
  assert.match(out, /## Fixed\n- Restore theme picker focus/);
  assert.match(out, /## Other changes\n<details>[\s\S]*Tidy the workflow caching setup/);
  assert.match(out, /## What to check\n- \[#150\].*: Open Themes, pick one/);
  assert.match(out, /## Known issues\n- Picker flickers/);
  assert.match(out, /## Previous release\n- staging-20261030-def5678 \(2026-10-30\)/);
});

test('template footer links the Releases page', () => {
  assert.match(buildReleaseTemplate(['feat: add staging banner (#1)'], META), /All releases: https:\/\/github\.com\/o\/r\/releases$/);
});

test('template omits empty sections and falls back when nothing is meaningful', () => {
  const out = buildReleaseTemplate(['wip'], { ...META, checkNotes: {}, knownIssues: '', updateGroup: '', previousTag: '' });
  assert.ok(!out.includes('## What to check'));
  assert.ok(!out.includes('## Known issues'));
  assert.ok(!out.includes('EAS update group'));
  assert.match(out, /## Fixed\n- Bug fixes and improvements/);
  assert.match(out, /- None found/);
});

test('extractCheckNotes reads the section and ignores placeholders', () => {
  assert.equal(extractCheckNotes('## Summary\nx\n\n## Tester notes\nOpen Themes\n\n## Other\ny'), 'Open Themes');
  assert.equal(extractCheckNotes('## Tester notes\n<!-- describe -->\n'), '');
  assert.equal(extractCheckNotes('## Tester notes\nN/A\n'), '');
  assert.equal(extractCheckNotes('no section'), '');
});

test('extractCheckNotes reads "What to check" and the legacy "Tester notes" heading', () => {
  assert.equal(extractCheckNotes('## What to check\nOpen Themes\n\n## Checks\n- x'), 'Open Themes');
  assert.equal(extractCheckNotes('## Tester notes\nOpen Themes'), 'Open Themes');
});

test('extractCheckNotes keeps real notes that start with "No" or "Not"', () => {
  assert.equal(extractCheckNotes('## What to check\nNotifications now show a badge'), 'Notifications now show a badge');
  assert.equal(extractCheckNotes('## What to check\nNo crash when opening settings'), 'No crash when opening settings');
});

test('extractCheckNotes drops only exact placeholders', () => {
  for (const placeholder of ['', '-', '- ', 'N/A', 'none', 'TBD', 'None.', '<!-- hint -->']) {
    assert.equal(extractCheckNotes(`## What to check\n${placeholder}\n\n## Checks\n- x`), '', JSON.stringify(placeholder));
  }
});

test('scrub rewrites tester(s) to user(s), any case, whole words only', () => {
  assert.equal(scrub('Testers and a Tester; TESTERS. attester contest'), 'users and a user; users. attester contest');
});

test('template never contains "tester" even when subjects, PR notes and known issues do', () => {
  const out = buildReleaseTemplate(['fix: tester can now see the picker (#150)', 'feat: banner for testers on home (#148)'], {
    ...META,
    checkNotes: { 150: 'Ask the tester to open Themes', 148: 'Testers see a banner' },
    knownIssues: '- Testers may see flicker',
  });
  assert.doesNotMatch(out, /tester/i);
  assert.match(out, /Ask the user to open Themes/);
});

test('short EAS line and list never contain "tester"', () => {
  const { buildReleaseNotes, buildReleaseNotesList } = require('../eas-release-notes');
  const subjects = ['fix: tester can now see the picker (#150)', 'feat: banner for Testers on home (#148)'];
  assert.doesNotMatch(buildReleaseNotes(subjects), /tester/i);
  assert.doesNotMatch(buildReleaseNotesList(subjects), /tester/i);
});

test('fetchCheckNotes reads PR bodies through gh and tolerates failures', () => {
  const calls = [];
  const run = (cmd, args) => {
    calls.push(args[2]);
    if (args[2] === '2') throw new Error('gh failed');
    return '## What to check\nOpen Themes\n';
  };
  const notes = fetchCheckNotes(['fix: something real here (#1)', 'fix: another real thing (#2)', 'fix: dup real thing (#1)'], 'o/r', { GH_TOKEN: 't' }, run);
  assert.deepEqual(notes, { 1: 'Open Themes', 2: '' });
  assert.deepEqual(calls, ['1', '2']);
});

test('fetchCheckNotes does nothing without a token or repo', () => {
  assert.deepEqual(fetchCheckNotes(['fix: something real here (#1)'], 'o/r', {}, () => 'x'), {});
  assert.deepEqual(fetchCheckNotes(['fix: something real here (#1)'], '', { GH_TOKEN: 't' }, () => 'x'), {});
});

test('parseUpdateGroup reads the group from eas update --json output', () => {
  assert.equal(parseUpdateGroup('[{"id":"a","group":"g-123","platform":"android"}]'), 'g-123');
  assert.equal(parseUpdateGroup('{"group":"g-9"}'), 'g-9');
  assert.equal(parseUpdateGroup('not json'), '');
  assert.equal(parseUpdateGroup('[]'), '');
});
