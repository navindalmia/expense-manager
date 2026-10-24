#!/usr/bin/env node
// Blocks a PR into staging or master that changes app code without bumping the
// app version.
//   node scripts/version-guard.js <base-ref> [head-ref=HEAD]
// Rule (PROJECT_MEMORY/11-VERSIONING.md): when the PR changes app code
// (frontend/src or backend/src, excluding __tests__), the version in
// frontend/app.config.js (older refs: frontend/app.json) must be strictly
// greater than the base branch's, and frontend/package.json must carry the same
// version. Docs-, CI- and test-only PRs need no bump.
// Exit 0 = ok, 1 = blocked.
'use strict';

const { execFileSync } = require('node:child_process');

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(v) {
  const m = VERSION_RE.exec(String(v || '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}

// app.json is JSON; app.config.js declares `"version": "x.y.z"` in its base object.
function extractAppVersion(file, text) {
  if (file.endsWith('.json')) {
    try {
      return JSON.parse(text).expo?.version ?? null;
    } catch {
      return null;
    }
  }
  const m = /"version"\s*:\s*"([^"]+)"/.exec(text);
  return m ? m[1] : null;
}

function extractPackageVersion(text) {
  try {
    return JSON.parse(text).version ?? null;
  } catch {
    return null;
  }
}

const APP_CODE_RE = /^(frontend|backend)\/src\/(?!.*__tests__\/).+/;

function touchesAppCode(files) {
  return files.some((f) => APP_CODE_RE.test(f));
}

function evaluateVersion({ baseVersion, headVersion, headPackageVersion, changedFiles = null }) {
  if (changedFiles && !touchesAppCode(changedFiles)) {
    return { ok: true, reason: 'no app code changed (docs/CI/tests only); no version bump needed' };
  }
  const base = parseVersion(baseVersion);
  const head = parseVersion(headVersion);
  if (!head) return { ok: false, reason: `head app version '${headVersion}' is not MAJOR.MINOR.PATCH.` };
  if (!base) return { ok: false, reason: `base app version '${baseVersion}' is not MAJOR.MINOR.PATCH.` };
  if (compareVersions(head, base) <= 0) {
    return { ok: false, reason: `app version ${headVersion} was not bumped above the base branch's ${baseVersion}. Bump MINOR for features, PATCH for fixes only, MAJOR for breaking changes (PROJECT_MEMORY/11-VERSIONING.md).` };
  }
  if (headPackageVersion !== headVersion) {
    return { ok: false, reason: `frontend/package.json version '${headPackageVersion}' must equal the app version ${headVersion}.` };
  }
  return { ok: true, reason: `${baseVersion} -> ${headVersion}` };
}

function show(ref, file) {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function changedFilesBetween(baseRef, headRef) {
  try {
    return execFileSync('git', ['diff', '--name-only', `${baseRef}...${headRef}`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

function readAppVersion(ref) {
  for (const file of ['frontend/app.config.js', 'frontend/app.json']) {
    const text = show(ref, file);
    if (text !== null) return extractAppVersion(file, text);
  }
  return null;
}

function main(argv) {
  const [baseRef, headRef = 'HEAD'] = argv;
  if (!baseRef) {
    console.error('usage: version-guard.js <base-ref> [head-ref]');
    return 1;
  }
  const result = evaluateVersion({
    baseVersion: readAppVersion(baseRef),
    headVersion: readAppVersion(headRef),
    headPackageVersion: extractPackageVersion(show(headRef, 'frontend/package.json') ?? ''),
    changedFiles: changedFilesBetween(baseRef, headRef),
  });
  console.log(`[version-guard] ${result.ok ? 'OK' : 'BLOCKED'}: ${result.reason}`);
  return result.ok ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { touchesAppCode, parseVersion, compareVersions, extractAppVersion, extractPackageVersion, evaluateVersion };
