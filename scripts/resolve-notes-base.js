#!/usr/bin/env node
// Resolves the commit that release notes should start from.
//   node scripts/resolve-notes-base.js [--since <ref>] [--before <sha>] [--head <sha>]
// Prints one sha (or nothing). Precedence:
//   1. --since (manual override, workflow_dispatch input)
//   2. newest "staging-YYYYMMDD-<sha7>" release tag that is an ancestor of head
//      and does not point at head itself (the last PUBLISHED staging update)
//   3. --before (github.event.before)
// An unresolvable --since/--before is an error (exit 1, ::error::), never a silent fallback.
// Without this, two merges seconds apart make the later push's notes cover only
// its own commits, so the earlier change never reaches testers on the latest update.
'use strict';

const { execFileSync } = require('node:child_process');

const TAG_PATTERN = /^staging-\d{8}-[0-9a-f]{7}$/;
const NULL_SHA = /^0+$/;

class NotesBaseError extends Error {}

// Pure: tags is [{ name, sha, time }]. isAncestor(sha) says whether sha is an ancestor of head.
// verify(ref) returns the full sha of a ref or null when it does not resolve. An explicit
// `since`, or an `event.before` that is the only base left, that does not resolve is an error:
// publishing generic notes for the wrong range would pass silently.
function resolveNotesBase({ since, before, head, tags = [], isAncestor, verify = (ref) => ref }) {
  if (since && since.trim()) {
    const ref = since.trim();
    if (ref.startsWith('-')) {
      throw new NotesBaseError(`since must be a commit or ref, not an option: ${ref}`);
    }
    const sha = verify(ref);
    if (!sha) {
      throw new NotesBaseError(`since does not resolve to a commit: ${ref}`);
    }
    return sha;
  }
  const candidates = tags
    .filter((tag) => TAG_PATTERN.test(tag.name) && tag.sha !== head && isAncestor(tag.sha))
    .sort((a, b) => b.time - a.time || (a.name < b.name ? 1 : -1));
  if (candidates.length > 0) {
    return candidates[0].sha;
  }
  if (!before || NULL_SHA.test(before)) {
    return '';
  }
  const sha = verify(before);
  if (!sha) {
    throw new NotesBaseError(`no published staging release found and the previous push commit ${before} no longer exists (force-push?); pass the since input`);
  }
  return sha;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function listStagingTags() {
  let names;
  try {
    names = git(['tag', '--list', 'staging-*']).split('\n').filter((n) => TAG_PATTERN.test(n));
  } catch {
    return [];
  }
  const tags = [];
  for (const name of names) {
    try {
      const [sha, time] = git(['log', '-1', '--format=%H %ct', `${name}^{commit}`]).split(' ');
      tags.push({ name, sha, time: Number(time) });
    } catch {
      // unreadable tag: ignore
    }
  }
  return tags;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    out[argv[i].replace(/^--/, '')] = argv[i + 1] || '';
  }
  return out;
}

if (require.main === module) {
  const { since, before, head = 'HEAD' } = parseArgs(process.argv.slice(2));
  const verify = (ref) => {
    try {
      return git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
    } catch {
      return null;
    }
  };
  const headSha = verify(head);
  if (!headSha) {
    process.stderr.write(`::error::head does not resolve: ${head}\n`);
    process.exit(1);
  }
  const isAncestor = (sha) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', sha, headSha], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  try {
    process.stdout.write(`${resolveNotesBase({ since, before, head: headSha, tags: listStagingTags(), isAncestor, verify })}\n`);
  } catch (error) {
    if (!(error instanceof NotesBaseError)) throw error;
    process.stderr.write(`::error::${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { resolveNotesBase, NotesBaseError, TAG_PATTERN };
