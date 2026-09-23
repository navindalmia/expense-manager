#!/usr/bin/env node
// Regression-pack gate. WHERE THINGS RUN:
//   * The regression suites (jest/vitest) run ONLY in GitHub CI (`suites` mode, `regression-gate` job) - never on
//     the developer's machine at commit time. Local hooks are STATIC only: no node_modules, no npm, no test runner.
//   * `static` and `msg` run from the git hooks in well under a second. `pr` runs in CI (closes --no-verify).
//   * The .claude hooks are Claude-only and separate.
//   node scripts/regression-gate.js e2e-eval <json> CI: fail unless the Playwright JSON report has >=1 passed and 0 skipped/failed/flaky
//   node scripts/regression-gate.js static         pre-commit: static scan of STAGED regression files (unit dirs AND e2e/regression) (banned modifiers, undiscoverable files)
//   node scripts/regression-gate.js suites         CI (and `npm run test:regression`): scan + run backend/frontend suites on the checked-out tree
//   node scripts/regression-gate.js msg <msg-file> commit-msg: fix-commit / deletion / weakening rules
//   node scripts/regression-gate.js pr <base-ref>  CI: same rules over a PR range or push range (closes --no-verify)
//                                                  env PR_HEAD_REF / PR_TITLE are extra "this is a fix" signals.
//
// Qualifying regression file (satisfies the fix-commit rule): status ADDED, under
// backend/src/__tests__/regression/ or frontend/src/__tests__/regression/, named
// issue-<N>-*.(test|spec).<ext> with an extension the workspace runner discovers, containing at least
// one real test call AND at least one assertion, and no .skip/.todo/.only/.fails. e2e/regression/ never
// satisfies the rule (nothing runs it automatically).
//
// LIMITS, stated plainly: the gate CANNOT prove a test is red-before-green or that it exercises the
// fixed code; it only rejects empty/vacuous/skipped files. Red-before-green is enforced by
// /ce-code-review and the PR description, NOT by this gate.
//
// Accepted and documented (not built): a message-only reword or `--allow-empty` fix commit passes
// locally (CI pr mode is the backstop); an amend that stages a small tweak is judged on the tweak only;
// `git commit --no-verify` skips local hooks (only CI plus branch protection close that).
// Exemptions are real trailers (last paragraph of the message) and scoped PER COMMIT.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORKSPACES = {
  backend: { dir: 'backend/src/__tests__/regression/', exts: ['ts'] }, // jest testMatch is .ts only
  frontend: { dir: 'frontend/src/__tests__/regression/', exts: ['ts', 'tsx', 'js', 'jsx'] }, // vitest default include
};
// Everything statically scanned (banned modifiers, discoverability). e2e is scanned but never run by the unit runners.
const SCAN_TARGETS = { ...WORKSPACES, e2e: { dir: 'e2e/regression/', exts: ['ts', 'js'] } };
const ALL_REGRESSION_DIRS = [...Object.values(WORKSPACES).map((w) => w.dir), 'e2e/regression/'];
const RUNNER_TIMEOUT_MS = 120000;
const FIX_WORD_RE = /^(?:(?:fixup|squash)!\s*)?(?:hot|bug)?fix(?:es|ed)?(?![\w-])/i;
const BANNED_RE = /\b(?:it|test|describe)\.(?:skip|todo|only|fails|failing|fixme|fail)\b|\.(?:skip|fixme)\s*\(|\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(|\bexpect\.fail\b/;
const TEST_CALL_RE = /(?<![.\w$])(?:it|test)(?:\.each\s*\([^)]*\))?\s*\(/g;
const ASSERT_RE = /(?<![.\w$])(?:expect|assert)\s*[.(]/g;

// ---------- pure helpers ----------
function cleanMessage(raw) {
  const lines = String(raw).replace(/^﻿/, '').split(/\r?\n/).filter((l) => !l.startsWith('#'));
  while (lines.length && lines[0].trim() === '') lines.shift();
  return lines.join('\n');
}
/** Is this subject/title a fix signal? Handles "Fix x", "fixes #1: x", "[fix] x", "bugfix - x", BOM/NBSP/emoji prefixes. */
function isFixSubject(subject) {
  const s = String(subject).replace(/^[\s ﻿​[\](){}*_>\-\p{Extended_Pictographic}\p{Emoji_Presentation}️‍]+/u, '');
  return FIX_WORD_RE.test(s);
}
function isFixCommit(raw) {
  return isFixSubject(cleanMessage(raw).split('\n')[0] || '');
}
/** Trailers = "Key: value" lines of the LAST paragraph (never the subject paragraph). */
function parseTrailers(raw) {
  const paras = cleanMessage(raw).trimEnd().split(/\n[ \t]*\n/);
  if (paras.length < 2) return [];
  const out = [];
  for (const line of paras[paras.length - 1].split('\n')) {
    const m = /^([A-Za-z][A-Za-z0-9-]*):\s*(\S.*)$/.exec(line);
    if (m) out.push({ key: m[1].toLowerCase(), value: m[2] });
  }
  return out;
}
function hasExemption(raw) {
  return parseTrailers(raw).some((t) => t.key === 'regression-exempt');
}
function stripComments(src) {
  return String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
function hasBannedTestModifier(src) {
  return BANNED_RE.test(stripComments(src));
}
function countTests(src) { return (stripComments(src).match(TEST_CALL_RE) || []).length; }
function countAssertions(src) { return (stripComments(src).match(ASSERT_RE) || []).length; }
function hasRealTest(src) {
  return countTests(src) >= 1 && countAssertions(src) >= 1 && !hasBannedTestModifier(src);
}
function isRegressionPath(file) {
  return ALL_REGRESSION_DIRS.some((d) => file.startsWith(d));
}
function isQualifyingPath(file) {
  const m = /^(backend|frontend)\/src\/__tests__\/regression\/(?:.*\/)?issue-\d+-[^/]+\.(?:test|spec)\.(\w+)$/.exec(file);
  return !!m && WORKSPACES[m[1]].exts.includes(m[2]);
}
function hasQualifyingAddition(changes, readContent) {
  return changes.some((c) => c.status === 'A' && isQualifyingPath(c.path) && hasRealTest(readContent(c.path) || ''));
}
function deletedRegressionFiles(changes) {
  return changes.filter((c) => c.status === 'D' && isRegressionPath(c.path) && !c.path.endsWith('.gitkeep')).map((c) => c.path);
}
/** Modified regression files whose real test-call or assertion count DECREASED (weakening). */
function weakenedRegressionFiles(changes, readOld, readNew) {
  return changes.filter((c) => {
    if (c.status !== 'M' || !isRegressionPath(c.path) || c.path.endsWith('.gitkeep')) return false;
    const before = readOld(c.path);
    const after = readNew(c.path);
    if (before == null || after == null) return false;
    return countTests(after) < countTests(before) || countAssertions(after) < countAssertions(before);
  }).map((c) => c.path);
}
const FIX_HELP =
  'Add a NEW file backend|frontend/src/__tests__/regression/issue-<N>-<slug>.test.ts with at least one real test and one assertion, or add a trailer line "Regression-Exempt: <reason>".';

/** Pure decision for one commit (commit-msg stage). readOld = HEAD blob, readNew = staged blob. */
function evaluateCommit(message, changes, readNew = () => '', readOld = () => null) {
  const exempt = hasExemption(message);
  if (!exempt) {
    const deleted = deletedRegressionFiles(changes);
    if (deleted.length) return { ok: false, reason: `regression test(s) deleted or moved away: ${deleted.join(', ')}. Removing regression coverage needs a "Regression-Exempt: <reason>" trailer.` };
    const weak = weakenedRegressionFiles(changes, readOld, readNew);
    if (weak.length) return { ok: false, reason: `regression test(s) weakened (fewer tests or assertions): ${weak.join(', ')}. Needs a "Regression-Exempt: <reason>" trailer.` };
  }
  if (!isFixCommit(message)) return { ok: true, reason: 'not a fix commit' };
  if (exempt) return { ok: true, reason: 'Regression-Exempt trailer present' };
  if (changes.length === 0) return { ok: true, reason: 'message-only reword (CI pr mode re-checks the range)' };
  if (hasQualifyingAddition(changes, readNew)) return { ok: true, reason: 'qualifying regression test added' };
  return { ok: false, reason: `fix commit adds no qualifying regression test (must be a newly ADDED issue-<N>-*.test.ts under backend|frontend regression dirs with a real test and an assertion; e2e alone or edits do not count). ${FIX_HELP}` };
}

/**
 * Pure decision for a PR/push range.
 * commits: [{message, changes}] (per-commit name-status); net: range name-status;
 * io: {readNew(path), readBase(path)}; meta: {branch, title}.
 * Exemptions apply only to the commit carrying them; branch/title signals can only be exempted by the tip commit.
 */
function evaluatePr(commits, net, io, meta = {}) {
  const readNew = io.readNew || (() => '');
  const readBase = io.readBase || (() => null);
  const problems = [];
  const exemptTouching = (p) => commits.some((c) => hasExemption(c.message) && c.changes.some((x) => x.path === p));
  const del = deletedRegressionFiles(net).filter((p) => !exemptTouching(p));
  if (del.length) problems.push(`PR deletes regression test(s) without a Regression-Exempt trailer on the deleting commit: ${del.join(', ')}.`);
  const weak = weakenedRegressionFiles(net, readBase, readNew).filter((p) => !exemptTouching(p));
  if (weak.length) problems.push(`PR weakens regression test(s) (fewer tests/assertions) without a Regression-Exempt trailer: ${weak.join(', ')}.`);
  const unexemptedFix = commits.some((c) => isFixCommit(c.message) && !hasExemption(c.message));
  const branchSignal = /^fix\//i.test(meta.branch || '');
  const titleSignal = isFixSubject(meta.title || '');
  const tipExempt = commits.length > 0 && hasExemption(commits[0].message); // commits[0] = HEAD
  const metaFix = (branchSignal || titleSignal) && !tipExempt;
  if ((unexemptedFix || metaFix) && !hasQualifyingAddition(net, readNew)) {
    const why = unexemptedFix ? 'contains a fix commit' : `looks like a fix (${branchSignal ? 'branch ' + meta.branch : 'title'})`;
    problems.push(`PR ${why} but adds no qualifying regression test. ${FIX_HELP}`);
  }
  return problems.length ? { ok: false, reason: problems.join(' ') } : { ok: true, reason: 'ok' };
}

function evaluateSummary(summary) {
  if (!summary) return { ok: false, reason: 'no test summary produced' };
  const { passed = 0, failed = 0, pending = 0, todo = 0 } = summary;
  if (failed > 0) return { ok: false, reason: `${failed} test(s) failed` };
  if (pending > 0 || todo > 0) return { ok: false, reason: `${pending} skipped/pending and ${todo} todo test(s) are not allowed in the regression pack` };
  if (passed < 1) return { ok: false, reason: 'runner reported zero passing tests (files present but nothing ran)' };
  return { ok: true, reason: `${passed} passed` };
}
function evaluateRunnerResult(name, result, summary) {
  if (!result || result.error || result.status === null || result.status === undefined) {
    const why = result && result.error ? result.error.message : 'runner did not exit normally';
    return { ok: false, reason: `${name} regression runner could not start or timed out (${why}).` };
  }
  if (result.status !== 0) return { ok: false, reason: `${name} regression suite FAILED.` };
  const s = evaluateSummary(summary);
  return { ok: s.ok, reason: `${name}: ${s.reason}` };
}
/** Parses `git diff --name-status -z` output; a rename/copy (R/C) becomes D old + A new. */
function parseNameStatusZ(out) {
  const parts = String(out).split('\0');
  if (parts.length && parts[parts.length - 1] === '') parts.pop();
  const changes = [];
  for (let i = 0; i < parts.length;) {
    const st = parts[i][0];
    if (st === 'R' || st === 'C') {
      if (st === 'R') changes.push({ status: 'D', path: parts[i + 1] });
      changes.push({ status: 'A', path: parts[i + 2] });
      i += 3;
    } else {
      changes.push({ status: st, path: parts[i + 1] });
      i += 2;
    }
  }
  return changes;
}
function parseRunnerSummary(json) {
  try {
    const j = typeof json === 'string' ? JSON.parse(json) : json;
    return { passed: j.numPassedTests, failed: j.numFailedTests, pending: j.numPendingTests, todo: j.numTodoTests };
  } catch { return null; }
}
function quoteArgForWin(p) { return process.platform === 'win32' && /\s/.test(p) ? `"${p}"` : p; }

// ---------- git / fs plumbing ----------
function git(args, opts = {}) {
  return spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
}
function repoRoot() {
  const r = git(['rev-parse', '--show-toplevel']);
  if (r.status !== 0) throw new Error('not inside a git repository');
  return r.stdout.trim();
}
function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}
/** Static checks over [{rel, content()}] entries of one workspace's regression dir. */
function checkEntries(ws, entries) {
  const cfg = SCAN_TARGETS[ws];
  const tests = [];
  const problems = [];
  for (const { rel, content } of entries) {
    if (path.posix.basename(rel) === '.gitkeep') continue;
    const m = /\.(?:test|spec)\.(\w+)$/.exec(rel);
    if (!m || !cfg.exts.includes(m[1])) {
      problems.push(`${rel}: not a test file the ${ws} runner discovers (allowed: *.test|spec.{${cfg.exts.join(',')}})`);
      continue;
    }
    const src = content();
    if (src == null) { problems.push(`${rel}: could not read the file contents (failing closed)`); continue; }
    if (hasBannedTestModifier(src)) problems.push(`${rel}: contains .skip/.todo/.only/.fails (banned in the regression pack)`);
    tests.push(rel);
  }
  return { tests, problems };
}
function scanWorkspace(root, ws) {
  const entries = listFilesRecursive(path.join(root, SCAN_TARGETS[ws].dir)).map((f) => ({
    rel: path.relative(root, f).split(path.sep).join('/'),
    content: () => fs.readFileSync(f, 'utf8'),
  }));
  return checkEntries(ws, entries);
}
/** Same checks against the STAGED INDEX (ls-files + show), no working tree, no node_modules. */
function scanIndex(root) {
  const problems = [];
  for (const ws of Object.keys(SCAN_TARGETS)) {
    const ls = git(['ls-files', '--cached', '-z', '--', SCAN_TARGETS[ws].dir], { cwd: root });
    if (ls.status !== 0) { problems.push(`${ws}: could not list staged files (failing closed)`); continue; }
    const entries = ls.stdout.split('\0').filter(Boolean).map((rel) => ({ rel, content: () => showBlob(root, `:${rel}`) }));
    problems.push(...checkEntries(ws, entries).problems);
  }
  return problems;
}
/** Playwright JSON reporter `stats`: require >=1 passed and 0 skipped/failed/flaky. Fails closed on anything odd. */
function evaluateE2eStats(stats) {
  if (!stats || typeof stats !== 'object') return { ok: false, reason: 'no stats in the Playwright JSON report' };
  const { expected = 0, unexpected = 0, flaky = 0, skipped = 0 } = stats;
  if (unexpected > 0) return { ok: false, reason: `${unexpected} e2e test(s) failed` };
  if (flaky > 0) return { ok: false, reason: `${flaky} flaky e2e test(s) (passed only on retry) are not allowed` };
  if (skipped > 0) return { ok: false, reason: `${skipped} e2e test(s) were skipped; skips are not allowed in the regression pack` };
  if (expected < 1) return { ok: false, reason: 'zero e2e tests passed (nothing executed)' };
  return { ok: true, reason: `${expected} e2e test(s) passed` };
}
function evaluateE2eReportFile(file) {
  let json;
  try { json = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { ok: false, reason: `cannot read Playwright JSON report ${file} (${e.message})` }; }
  return evaluateE2eStats(json.stats);
}
function runnerArgs(ws, jsonFile) {
  const out = quoteArgForWin(jsonFile);
  return ws === 'backend'
    ? ['run', 'test:regression', '--', '--json', `--outputFile=${out}`]
    : ['run', 'test:regression', '--', '--reporter=default', '--reporter=json', `--outputFile.json=${out}`];
}
/** Runs a command with a timeout that kills the WHOLE process group (POSIX) / tree (win32). Resolves spawnSync-shaped. */
function runWithTimeout(cmd, args, opts, timeoutMs) {
  return new Promise((resolve) => {
    const win = process.platform === 'win32';
    let child;
    try { child = spawn(cmd, args, { ...opts, detached: !win, shell: win }); }
    catch (error) { resolve({ status: null, error }); return; }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (win) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
        else process.kill(-child.pid, 'SIGKILL');
      } catch { /* already gone */ }
    }, timeoutMs);
    child.on('error', (error) => { clearTimeout(timer); resolve({ status: null, error }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(timedOut ? { status: null, error: new Error(`timed out after ${timeoutMs}ms`) } : { status: code });
    });
  });
}
async function runSuites(root, nodeModulesFrom, timeoutMs = RUNNER_TIMEOUT_MS) {
  const failures = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'regr-json-'));
  try {
    for (const ws of Object.keys(WORKSPACES)) {
      const { tests, problems } = scanWorkspace(root, ws);
      if (problems.length) { failures.push(...problems); continue; }
      if (!tests.length) { console.log(`[regression-gate] ${ws}: no regression tests yet, skipping`); continue; }
      const realNm = path.join(nodeModulesFrom, ws, 'node_modules');
      if (!fs.existsSync(realNm)) { failures.push(`${ws}: node_modules missing. Run npm install in ${ws}/.`); continue; }
      const nm = path.join(root, ws, 'node_modules');
      if (!fs.existsSync(nm)) fs.symlinkSync(realNm, nm, process.platform === 'win32' ? 'junction' : 'dir');
      const jsonFile = path.join(tmp, `${ws}.json`);
      console.log(`[regression-gate] running ${ws} regression suite (${tests.length} file(s))...`);
      const res = await runWithTimeout('npm', runnerArgs(ws, jsonFile), { cwd: path.join(root, ws), stdio: 'inherit' }, timeoutMs);
      const summary = fs.existsSync(jsonFile) ? parseRunnerSummary(fs.readFileSync(jsonFile, 'utf8')) : null;
      const d = evaluateRunnerResult(ws, res, summary);
      if (!d.ok) failures.push(d.reason);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return failures;
}
function report(failures) {
  if (!failures.length) return 0;
  console.error('\n[regression-gate] BLOCKED:\n - ' + failures.join('\n - '));
  return 1;
}
function showBlob(root, spec) {
  const r = git(['show', spec], { cwd: root });
  return r.status === 0 ? r.stdout : null;
}
function stagedChanges(root) {
  const r = git(['diff', '--cached', '--name-status', '-z', '--no-renames'], { cwd: root });
  if (r.status !== 0) throw new Error('git diff --cached failed');
  return parseNameStatusZ(r.stdout);
}
function prMode(root, base, env) {
  const revs = git(['rev-list', `${base}..HEAD`], { cwd: root });
  if (revs.status !== 0) return report([`cannot resolve range ${base}..HEAD: ${revs.stderr}`]);
  const commits = revs.stdout.split('\n').filter(Boolean).map((h) => {
    const msg = git(['log', '-1', '--format=%B', h], { cwd: root }).stdout;
    const ch = git(['diff-tree', '--no-commit-id', '--name-status', '-r', '-z', '--no-renames', h], { cwd: root });
    return { message: msg, changes: parseNameStatusZ(ch.stdout || '') };
  }); // rev-list is newest first, so commits[0] is HEAD
  const diff = git(['diff', '--name-status', '-z', '--no-renames', `${base}...HEAD`], { cwd: root });
  if (diff.status !== 0) return report([`cannot diff ${base}...HEAD: ${diff.stderr}`]);
  const mb = git(['merge-base', base, 'HEAD'], { cwd: root }).stdout.trim() || base;
  const d = evaluatePr(commits, parseNameStatusZ(diff.stdout), {
    readNew: (p) => showBlob(root, `HEAD:${p}`),
    readBase: (p) => showBlob(root, `${mb}:${p}`),
  }, { branch: env.PR_HEAD_REF, title: env.PR_TITLE });
  return report(d.ok ? [] : [d.reason]);
}

async function main(argv) {
  const [mode, arg] = argv;
  const root = repoRoot();
  if (mode === 'suites') return report([...scanWorkspace(root, 'e2e').problems, ...(await runSuites(root, root))]);
  if (mode === 'e2e-eval') {
    const d = evaluateE2eReportFile(arg || 'playwright-results.json');
    if (d.ok) console.log(`[regression-gate] ${d.reason}`);
    return report(d.ok ? [] : [d.reason]);
  }
  if (mode === 'static') return report(scanIndex(root));
  if (mode === 'msg') {
    const file = arg || path.join(root, '.git', 'COMMIT_EDITMSG');
    let message;
    try { message = fs.readFileSync(file, 'utf8'); }
    catch (e) { return report([`cannot read commit message (${e.message})`]); }
    const d = evaluateCommit(message, stagedChanges(root), (p) => showBlob(root, `:${p}`), (p) => showBlob(root, `HEAD:${p}`));
    return report(d.ok ? [] : [d.reason]);
  }
  if (mode === 'pr') {
    if (!arg) return report(['usage: pr <base-ref>']);
    return prMode(root, arg, process.env);
  }
  console.error('usage: regression-gate.js static | suites | e2e-eval <json> | msg <file> | pr <base-ref>');
  return 2;
}

module.exports = {
  evaluateCommit, evaluatePr, evaluateRunnerResult, evaluateSummary, parseNameStatusZ, parseRunnerSummary, parseTrailers,
  isFixCommit, isFixSubject, hasExemption, cleanMessage, isQualifyingPath, hasRealTest, hasBannedTestModifier,
  countTests, countAssertions, weakenedRegressionFiles, scanWorkspace, hasQualifyingAddition, runWithTimeout, checkEntries, evaluateE2eStats, evaluateE2eReportFile,
};
if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
