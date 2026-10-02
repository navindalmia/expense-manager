// Shared detection logic for this repo's testing/E2E/visual-regression rules,
// documented in CLAUDE.md / PROJECT_MEMORY/05-QUALITY_STANDARDS.md.
//
// Used by two consumers that must never silently drift apart:
//   - .claude/hooks/pre-commit-quality-gate.js  (local, per-commit, staged-diff based)
//   - .claude/scripts/audit-pr-principles.js    (CI, per-PR, commit-range based)
//
// Both operate on the same inputs per commit (a list of changed file paths,
// plus the commit message), so the file-classification regexes and trailer
// parsing live here once instead of being copy-pasted and edited out of sync.

function isScreenOrComponentTsx(file) {
  const isScreensOrComponents =
    /^frontend\/src\/screens\/.*\.tsx$/.test(file) ||
    /^frontend\/src\/components\/.*\.tsx$/.test(file);
  if (!isScreensOrComponents) return false;
  if (/\/__tests__\//.test(file)) return false;
  if (/\.test\.tsx$/.test(file)) return false;
  return true;
}

function isPlaywrightE2eFile(file) {
  return /^e2e\//.test(file);
}

function isMaestroVisualFile(file) {
  return /^maestro-flows\/visual\//.test(file);
}

function isTestFile(file) {
  return /\/__tests__\//.test(file) || /^e2e\//.test(file) || /\.test\.tsx?$/.test(file);
}

function isFixOrFeatCommit(commitMessage) {
  return /^(fix|feat)\(/.test(commitMessage.trim());
}

// Parses a `<Name>: <reason>` git trailer out of a commit message. Returns
// the reason string (trimmed) if the trailer is present, or null otherwise.
// Line-anchored: the reason must start on the same line as the trailer name
// (an empty trailer followed by another line does not count). Also captures the reason text, which the hook
// itself never needed but the PR-level audit summary does.
function extractTrailer(commitMessage, trailerName) {
  const re = new RegExp(`^${trailerName}:[ \\t]*(\\S.*)$`, 'm');
  const match = commitMessage.match(re);
  if (!match) return null;
  const reason = match[1].trim();
  return reason.length > 0 ? reason : null;
}

module.exports = {
  isScreenOrComponentTsx,
  isPlaywrightE2eFile,
  isMaestroVisualFile,
  isTestFile,
  isFixOrFeatCommit,
  extractTrailer,
};
