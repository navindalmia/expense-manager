'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const text = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8');
const live = text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const job = (live.split(/^  principles-check:\s*$/m)[1] || '').split(/^  [A-Za-z0-9_-]+:\s*$/m)[0];

test('principles-check job exists, runs on pull_request only and is a normal failing job', () => {
  assert.ok(job.length > 0, 'principles-check job missing from ci.yml');
  assert.match(job, /github\.event_name == 'pull_request'/);
  assert.doesNotMatch(job, /continue-on-error/);
});

test('principles-check job fetches full history, runs the script with --require-jscpd and needs no secrets or database', () => {
  assert.match(job, /fetch-depth:\s*0/);
  assert.match(job, /node scripts\/principles-check\.js[^\n]*--require-jscpd/);
  assert.doesNotMatch(job, /secrets\./);
  assert.doesNotMatch(job, /postgres|DATABASE_URL/i);
});

test('principles-check job pins actions to a major tag like the rest of the file and keeps untrusted refs in env', () => {
  for (const m of job.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /@v\d+/, m[1]);
  assert.doesNotMatch(job, /run:[^\n]*\$\{\{\s*github\.(head_ref|base_ref|event)/);
});
