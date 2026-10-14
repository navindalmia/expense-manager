#!/usr/bin/env node
// Builds a short, human-readable "what changed" summary for an EAS build/update.
//   node scripts/eas-release-notes.js <before-sha> <head-sha>
// Prints one line to stdout. Source is the commit subjects in before..head;
// squash-merged commits carry the PR title as their subject, so those are
// already written for a reader. Terse or empty subjects are dropped, and when
// nothing meaningful remains a generic-but-honest message is printed instead of
// leaking raw text such as "wip". Subjects are passed via argv/stdout only and
// never interpolated into a shell string.
'use strict';

const { execFileSync } = require('node:child_process');

const FALLBACK = 'Bug fixes and improvements';
const MAX_LENGTH = 200;
const MIN_SUBJECT_LENGTH = 12;
const NULL_SHA = /^0+$/;

// "feat(scope): text (#12)" -> "text"
function cleanSubject(subject) {
  return subject
    .replace(/^\s*\w+(\([^)]*\))?!?:\s*/, '')
    .replace(/\s*\(#\d+\)\s*$/, '')
    .trim();
}

function isMeaningful(text) {
  return text.length >= MIN_SUBJECT_LENGTH && !/^(wip|fix|update|misc|merge\b.*)$/i.test(text);
}

function buildReleaseNotes(subjects) {
  const notes = subjects
    .filter((subject) => !/^merge\b/i.test(subject.trim()))
    .map(cleanSubject)
    .filter(isMeaningful)
    .map((text) => text.charAt(0).toUpperCase() + text.slice(1));

  if (notes.length === 0) {
    return FALLBACK;
  }

  const joined = notes.join('; ');
  return joined.length > MAX_LENGTH ? `${joined.slice(0, MAX_LENGTH - 3).trimEnd()}...` : joined;
}

function readSubjects(before, head) {
  const range = !before || NULL_SHA.test(before) ? `${head}~1..${head}` : `${before}..${head}`;
  try {
    const out = execFileSync('git', ['log', '--format=%s', range], { encoding: 'utf8' });
    return out.split('\n').filter((line) => line.trim().length > 0);
  } catch {
    return [];
  }
}

if (require.main === module) {
  const [before, head = 'HEAD'] = process.argv.slice(2);
  process.stdout.write(`${buildReleaseNotes(readSubjects(before, head))}\n`);
}

module.exports = { buildReleaseNotes, cleanSubject };
