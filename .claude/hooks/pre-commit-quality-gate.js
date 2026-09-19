#!/usr/bin/env node
// Deterministic pre-commit quality gate: enforces repo testing rules from
// CLAUDE.md / PROJECT_MEMORY/05-QUALITY_STANDARDS.md ("Testing — FAIL if any missing"):
//
//   Rule 1 (UI-change-needs-E2E): if the staged diff touches
//     frontend/src/screens/**/*.tsx or frontend/src/components/**/*.tsx
//     (excluding __tests__ dirs and *.test.tsx files), the staged diff must also
//     touch something under e2e/ or maestro-flows/ — OR the commit message must
//     contain the trailer `E2E-Exempt: <reason>`.
//
//   Rule 2 (fix/feat-needs-test): if the commit message starts with `fix(` or
//     `feat(` (this repo's conventional-commit style), the staged diff must also
//     touch a test file (__tests__/, e2e/, or *.test.ts(x)) — OR the commit
//     message must contain the trailer `Test-Exempt: <reason>`. Originally
//     `fix(`-only; broadened to `feat(` too so new features get a regression
//     test the same way bug fixes do, not just an E2E case (Rule 1 already
//     covers E2E for UI features specifically).
//
//   Rule 3 (UI-change-needs-visual-regression-baseline): if the staged diff
//     touches frontend/src/screens/**/*.tsx or frontend/src/components/**/*.tsx
//     (same detection as Rule 1), the staged diff must also touch a Maestro
//     visual-regression flow under maestro-flows/visual/ (this repo's existing
//     `assertScreenshot` baseline mechanism — see maestro-flows/visual/*.yaml)
//     — OR the commit message must contain the trailer
//     `Visual-Regression-Exempt: <reason>`. Deliberately an exempt-trailer
//     rule, not a hard requirement to add/update a baseline every time: most
//     dev environments (including this repo's own cloud sandbox sessions)
//     cannot run the Android-emulator Maestro pipeline that generates/verifies
//     screenshot baselines at all, so a hard block here would fail closed
//     everywhere rather than just prompting a deliberate, recorded decision.
//
//   Rule 4 (UI-change-needs-real-Playwright-E2E): if the staged diff touches
//     frontend/src/screens/**/*.tsx or frontend/src/components/**/*.tsx (same
//     detection as Rule 1/3), the staged diff must also touch something under
//     e2e/ specifically (Playwright) — OR the commit message must contain the
//     trailer `E2E-Exempt: <reason>` (same trailer as Rule 1). Rule 1 already
//     accepts e2e/ *or* maestro-flows/ as satisfying "some E2E coverage
//     exists"; Rule 4 tightens that for the case a UI commit only touches
//     maestro-flows/ (functional or visual) with no real Playwright spec at
//     all — added so the CI-level `principles-audit` job (which mirrors this
//     rule) and this local hook agree on what "real E2E" requires.
//
// Mirrors pre-commit-gate.js's style/structure exactly: plain Node, cross-platform,
// resolves the actual target repo from the git command (not just hook cwd), and
// fails OPEN (allows the commit) whenever detection is ambiguous — a broken/unknown
// environment must never block an unrelated commit.

const { spawnSync } = require('child_process');
const fs = require('fs');
const {
  isScreenOrComponentTsx,
  isE2eOrMaestroFile,
  isPlaywrightE2eFile,
  isMaestroVisualFile,
  isTestFile,
  isFixOrFeatCommit,
} = require('../scripts/lib/commit-rules');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function resolveTargetDir(hookInput) {
  const command = hookInput && hookInput.tool_input && hookInput.tool_input.command;
  if (typeof command === 'string') {
    const match = command.match(/git\s+-C\s+"?([^"\s]+)"?/);
    if (match) return match[1];
  }
  return (hookInput && hookInput.cwd) || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function resolveRepoRoot(dir) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' });
  if (result.status === 0 && result.stdout) return result.stdout.trim();
  return null;
}

function getStagedFiles(repoRoot) {
  const result = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;
  return result.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
}

// Extract the commit message the same way pre-commit-gate.js reads tool_input:
// from the `git commit` command's -m flags (handles single or repeated -m, and
// -F files is intentionally not resolved — falls back to empty, which fails open
// on rule enforcement since neither rule can then match).
function extractCommitMessage(command) {
  if (typeof command !== 'string') return null;
  const messages = [];
  const re = /-m\s+("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(command)) !== null) {
    messages.push(match[2] !== undefined ? match[2] : match[3]);
  }
  if (messages.length === 0) return null;
  return messages.join('\n\n');
}

const hookInput = readStdinJson();
const command = hookInput && hookInput.tool_input && hookInput.tool_input.command;
const targetDir = resolveTargetDir(hookInput);
const repoRoot = resolveRepoRoot(targetDir);

// Fail open: can't resolve a repo at all.
if (!repoRoot) {
  process.exit(0);
}

// Fail open: this isn't expense-manager (best-effort check, same philosophy as
// pre-commit-gate.js only checking tsconfig.json projects that exist in the target repo).
if (!fs.existsSync(`${repoRoot}/CLAUDE.md`) && !fs.existsSync(`${repoRoot}/frontend`) && !fs.existsSync(`${repoRoot}/backend`)) {
  process.exit(0);
}

const stagedFiles = getStagedFiles(repoRoot);

// Fail open: couldn't read the staged diff.
if (stagedFiles === null) {
  process.exit(0);
}

const commitMessage = extractCommitMessage(command);

// Fail open: couldn't determine the commit message being written — neither rule
// can be safely evaluated without it.
if (commitMessage === null) {
  process.exit(0);
}

const hasE2eExempt = /E2E-Exempt:\s*\S+/.test(commitMessage);
const hasTestExempt = /Test-Exempt:\s*\S+/.test(commitMessage);
const hasVisualRegressionExempt = /Visual-Regression-Exempt:\s*\S+/.test(commitMessage);

const blockers = [];

// Rule 1: UI change needs E2E coverage.
const touchesScreensOrComponents = stagedFiles.some(isScreenOrComponentTsx);
const touchesE2eOrMaestro = stagedFiles.some(isE2eOrMaestroFile);
if (touchesScreensOrComponents && !touchesE2eOrMaestro && !hasE2eExempt) {
  blockers.push(
    '[pre-commit-quality-gate] BLOCKED (Rule 1: UI change needs E2E coverage)\n' +
      'This commit touches frontend/src/screens/** or frontend/src/components/** but no ' +
      'e2e/ (Playwright) or maestro-flows/ (Maestro) file is staged.\n' +
      'Per CLAUDE.md / PROJECT_MEMORY/05-QUALITY_STANDARDS.md, UI changes need real E2E ' +
      'coverage, not just mocked unit/component tests.\n\n' +
      'To proceed:\n' +
      '  - Add or update a Playwright spec under e2e/ or a Maestro flow under maestro-flows/, or\n' +
      '  - If this change genuinely does not need one (pure refactor, copy/text tweak, etc.), ' +
      'add the trailer `E2E-Exempt: <short reason>` to the commit message.'
  );
}

// Rule 2: fix/feat commits need a regression test.
const touchesTestFile = stagedFiles.some(isTestFile);
if (isFixOrFeatCommit(commitMessage) && !touchesTestFile && !hasTestExempt) {
  blockers.push(
    '[pre-commit-quality-gate] BLOCKED (Rule 2: fix/feat needs a regression test)\n' +
      'This commit message starts with `fix(` or `feat(` but no test file (__tests__/, e2e/, or ' +
      '*.test.ts(x)) is staged.\n' +
      'Per CLAUDE.md, fix and feat commits should be paired with a regression test in the same commit.\n\n' +
      'To proceed:\n' +
      '  - Stage a regression test alongside the change, or\n' +
      '  - If a test genuinely cannot be added here, add the trailer `Test-Exempt: <reason>` ' +
      'to the commit message.'
  );
}

// Rule 3: UI change needs a visual-regression (screenshot) baseline.
const touchesMaestroVisual = stagedFiles.some(isMaestroVisualFile);
if (touchesScreensOrComponents && !touchesMaestroVisual && !hasVisualRegressionExempt) {
  blockers.push(
    '[pre-commit-quality-gate] BLOCKED (Rule 3: UI change needs a visual-regression baseline)\n' +
      'This commit touches frontend/src/screens/** or frontend/src/components/** but no ' +
      'maestro-flows/visual/*.yaml (this repo\'s `assertScreenshot` pixel-diff baseline) is staged.\n' +
      'Functional E2E (Rule 1) proves the feature works; it does not catch an unintended visual ' +
      'change (layout shift, color, spacing) the way a screenshot diff does.\n\n' +
      'To proceed:\n' +
      '  - Add or update the relevant maestro-flows/visual/*.yaml baseline (requires an Android ' +
      'emulator to generate/verify — see docs/solutions/build-errors/e2e-mobile-ci-hang-and-cascading-fixes.md ' +
      'for this repo\'s Maestro setup), or\n' +
      '  - If this change genuinely has no visual-regression baseline covering the screen touched, ' +
      'or a baseline can\'t be verified in this environment (e.g. no emulator access), add the ' +
      'trailer `Visual-Regression-Exempt: <short reason>` to the commit message.'
  );
}

// Rule 4: UI change needs real Playwright E2E specifically (not just any
// e2e-or-maestro file, which Rule 1 already accepts as sufficient).
const touchesPlaywrightE2e = stagedFiles.some(isPlaywrightE2eFile);
if (touchesScreensOrComponents && !touchesPlaywrightE2e && !hasE2eExempt) {
  blockers.push(
    '[pre-commit-quality-gate] BLOCKED (Rule 4: UI change needs real Playwright E2E)\n' +
      'This commit touches frontend/src/screens/** or frontend/src/components/** but no ' +
      'e2e/*.spec.ts (Playwright) file is staged — a maestro-flows/ change alone does not ' +
      'satisfy this rule.\n' +
      'Per CLAUDE.md / PROJECT_MEMORY/05-QUALITY_STANDARDS.md, UI changes need real E2E ' +
      'coverage against a live backend+DB, not just mocked unit/component tests.\n\n' +
      'To proceed:\n' +
      '  - Add or update a Playwright spec under e2e/, or\n' +
      '  - If this change genuinely does not need one, add the trailer ' +
      '`E2E-Exempt: <short reason>` to the commit message.'
  );
}

if (blockers.length > 0) {
  console.error(blockers.join('\n\n'));
  process.exit(2);
}

process.exit(0);
