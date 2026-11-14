#!/usr/bin/env node
// Builds a short, human-readable "what changed" summary for an EAS build/update.
//   node scripts/eas-release-notes.js [--list|--template] <before-sha> <head-sha>
//   node scripts/eas-release-notes.js --update-group <eas-update-json-file>
// --template prints the standard release-notes document (markdown); env: GITHUB_REPOSITORY,
// BUILD_KIND (ota|native), UPDATE_GROUP, GH_TOKEN (optional, for the PR "What to check" section).
// --list prints a markdown bullet list instead of one line.
// --update-group prints the EAS update group id from `eas update --json` output.
// Output is for end users: the word "tester(s)" is scrubbed from everything printed.
// An unreadable range exits 1 with ::error:: instead of printing generic notes.
// Default mode prints one line to stdout. Source is the commit subjects in before..head;
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

// Release notes are read by end users: never let contributor wording say "tester(s)".
function scrub(text) {
  return text.replace(/\btesters\b/gi, 'users').replace(/\btester\b/gi, 'user');
}

// "feat(scope): text (#12)" -> "text"
function cleanSubject(subject) {
  return subject
    .replace(/^\s*\w+(\([^)]*\))?!?:\s*/, '')
    .replace(/\s*\(#\d+\)\s*$/, '')
    .replace(/\s*\(#\d+\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isMeaningful(text) {
  return text.length >= MIN_SUBJECT_LENGTH && !/^(wip|fix|update|misc|merge\b.*)$/i.test(text);
}

function collectNotes(subjects) {
  const notes = subjects
    .filter((subject) => !/^merge\b/i.test(subject.trim()))
    .map(cleanSubject)
    .filter(isMeaningful)
    .map((text) => scrub(text.charAt(0).toUpperCase() + text.slice(1)));
  return [...new Set(notes)];
}

// Keeps whole items only; when they do not all fit, appends " (+N more)".
function joinWithinLimit(notes) {
  const full = notes.join('; ');
  if (full.length <= MAX_LENGTH) {
    return full;
  }
  const kept = [];
  for (let i = 0; i < notes.length; i += 1) {
    const suffix = ` (+${notes.length - i - 1} more)`;
    const candidate = [...kept, notes[i]].join('; ');
    if (candidate.length + suffix.length > MAX_LENGTH && kept.length > 0) {
      break;
    }
    kept.push(notes[i]);
  }
  const remaining = notes.length - kept.length;
  const text = kept.join('; ');
  if (kept.length === 1 && text.length + ` (+${remaining} more)`.length > MAX_LENGTH) {
    // a single oversized item: shorten it visibly
    const room = MAX_LENGTH - ` (+${remaining} more)`.length - 3;
    return `${text.slice(0, room).trimEnd()}...${remaining ? ` (+${remaining} more)` : ''}`;
  }
  return remaining > 0 ? `${text} (+${remaining} more)` : text;
}

function buildReleaseNotes(subjects) {
  const notes = collectNotes(subjects);
  return notes.length === 0 ? FALLBACK : joinWithinLimit(notes);
}

// Markdown bullet list of the same cleaned subjects (for job summaries, GitHub
// Releases and promotion PR bodies). Same filtering as buildReleaseNotes.
function buildReleaseNotesList(subjects) {
  const notes = collectNotes(subjects).map((text) => `- ${text}`);
  return notes.length === 0 ? `- ${FALLBACK}` : notes.join('\n');
}

function prNumber(subject) {
  const m = subject.match(/\(#(\d+)\)\s*$/);
  return m ? m[1] : null;
}

function commitType(subject) {
  const m = subject.match(/^\s*(\w+)(\([^)]*\))?!?:/);
  return m ? m[1].toLowerCase() : 'other';
}

function groupOf(type) {
  if (type === 'feat') return 'feat';
  if (type === 'fix') return 'fix';
  return 'other';
}

// Extracts the text under "## What to check" (legacy alias "## Tester notes") in a PR body.
// Empty when absent or an exact placeholder (n/a, none, tbd, -).
function extractCheckNotes(body) {
  if (!body) return '';
  const m = body.replace(/\r/g, '').match(/^##\s*(?:what to check|tester notes)[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/im);
  if (!m) return '';
  const text = m[1].replace(/<!--[\s\S]*?-->/g, '').trim();
  return /^(?:[-*]\s*)?(?:n\/?a|none|tbd|-)?\.?$/i.test(text) ? '' : text;
}

// Standard release-notes document. meta: { appVersion, runtimeVersion, sha, branch, buildKind,
// updateGroup, date, repo, previousTag, previousDate, knownIssues, checkNotes: {prNumber: text} }
function buildReleaseTemplate(subjects, meta) {
  const link = (n) => (meta.repo ? `[#${n}](https://github.com/${meta.repo}/pull/${n})` : `#${n}`);
  const groups = { feat: [], fix: [], other: [] };
  const seen = new Set();
  const checks = [];
  for (const subject of subjects) {
    if (/^merge\b/i.test(subject.trim())) continue;
    const text = cleanSubject(subject);
    if (!isMeaningful(text)) continue;
    const pr = prNumber(subject);
    const item = `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    if (seen.has(item)) continue;
    seen.add(item);
    groups[groupOf(commitType(subject))].push(pr ? `${item} (${link(pr)})` : item);
    const note = pr && meta.checkNotes ? meta.checkNotes[pr] : '';
    if (note) checks.push(`- ${link(pr)}: ${note.replace(/\n+/g, ' ')}`);
  }
  const bullets = (items) => items.map((i) => `- ${i}`).join('\n');
  const out = [`# Expense Manager ${meta.appVersion} (staging) - ${meta.date}`, ''];
  out.push('## Build info');
  out.push(`- App version: ${meta.appVersion}`);
  out.push(`- Runtime version: ${meta.runtimeVersion}`);
  out.push(`- Commit: ${meta.sha} (${meta.branch})`);
  out.push(`- Delivery: ${meta.buildKind === 'native' ? 'OTA update plus a new native build (APK)' : 'OTA update'}`);
  if (meta.updateGroup) out.push(`- EAS update group: ${meta.updateGroup}`);
  if (groups.feat.length) out.push('', "## What's new", bullets(groups.feat));
  if (groups.fix.length) out.push('', '## Fixed', bullets(groups.fix));
  if (groups.other.length) {
    out.push('', '## Other changes', '<details><summary>Show</summary>', '', bullets(groups.other), '', '</details>');
  }
  if (checks.length) out.push('', '## What to check', checks.join('\n'));
  if (meta.knownIssues && meta.knownIssues.trim()) out.push('', '## Known issues', meta.knownIssues.trim());
  if (groups.feat.length + groups.fix.length + groups.other.length === 0) {
    out.push('', `## Fixed`, `- ${FALLBACK}`);
  }
  out.push('', '## Previous release', meta.previousTag ? `- ${meta.previousTag}${meta.previousDate ? ` (${meta.previousDate})` : ''}` : '- None found');
  if (meta.repo) out.push('', `All releases: https://github.com/${meta.repo}/releases`);
  return scrub(out.join('\n'));
}

function readFileOr(path, fallback) {
  try {
    return require('node:fs').readFileSync(path, 'utf8');
  } catch {
    return fallback;
  }
}

function gitOr(args, fallback) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

function fetchCheckNotes(subjects, repo, env = process.env, run = execFileSync) {
  const notes = {};
  if (!repo || !env.GH_TOKEN) return notes;
  for (const subject of subjects) {
    const pr = prNumber(subject);
    if (!pr || notes[pr] !== undefined) continue;
    try {
      const body = run('gh', ['pr', 'view', pr, '--repo', repo, '--json', 'body', '--jq', '.body'], { encoding: 'utf8' });
      notes[pr] = extractCheckNotes(body);
    } catch {
      notes[pr] = '';
    }
  }
  return notes;
}

function templateMeta(before, head, subjects) {
  const config = readFileOr('frontend/app.config.js', '');
  const version = (config.match(/"version":\s*"([^"]+)"/) || [])[1] || 'unknown';
  const repo = process.env.GITHUB_REPOSITORY || '';
  const prevTag = before ? gitOr(['tag', '--points-at', before, '--list', 'staging-*'], '').split('\n')[0] : '';
  const dateMatch = prevTag.match(/^staging-(\d{4})(\d{2})(\d{2})-/);
  return {
    appVersion: version,
    runtimeVersion: version, // runtimeVersion.policy is "appVersion"
    sha: gitOr(['rev-parse', '--short=7', head], head),
    branch: process.env.GITHUB_REF_NAME || 'staging',
    buildKind: process.env.BUILD_KIND || 'ota',
    updateGroup: process.env.UPDATE_GROUP || '',
    date: new Date().toISOString().slice(0, 10),
    repo,
    previousTag: prevTag,
    previousDate: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '',
    knownIssues: readFileOr('docs/release/known-issues.md', ''),
    checkNotes: fetchCheckNotes(subjects, repo),
  };
}

function readSubjects(before, head) {
  const range = !before || NULL_SHA.test(before) ? `${head}~1..${head}` : `${before}..${head}`;
  const out = execFileSync('git', ['log', '--format=%s', '--end-of-options', range], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return out.split('\n').filter((line) => line.trim().length > 0);
}

// Group id of the published update from `eas update --json` output (array of updates).
function parseUpdateGroup(json) {
  try {
    const parsed = JSON.parse(json);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    const entry = entries.find((e) => e && typeof e.group === 'string' && e.group);
    return entry ? entry.group : '';
  } catch {
    return '';
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--update-group') {
    process.stdout.write(`${parseUpdateGroup(readFileOr(args[1] || '', ''))}\n`);
    process.exit(0);
  }
  const asList = args[0] === '--list';
  const asTemplate = args[0] === '--template';
  const [before, head = 'HEAD'] = asList || asTemplate ? args.slice(1) : args;
  let subjects;
  try {
    subjects = readSubjects(before, head);
  } catch (error) {
    process.stderr.write(`::error::cannot read commits for ${before || '(none)'}..${head}: ${String(error.message).split('\n')[0]}\n`);
    process.exit(1);
  }
  if (asTemplate) {
    process.stdout.write(`${buildReleaseTemplate(subjects, templateMeta(before, head, subjects))}\n`);
    process.exit(0);
  }
  process.stdout.write(`${asList ? buildReleaseNotesList(subjects) : buildReleaseNotes(subjects)}\n`);
}

module.exports = {
  buildReleaseNotes,
  buildReleaseNotesList,
  buildReleaseTemplate,
  extractCheckNotes,
  fetchCheckNotes,
  parseUpdateGroup,
  scrub,
  cleanSubject,
};
