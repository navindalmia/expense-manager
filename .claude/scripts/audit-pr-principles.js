#!/usr/bin/env node
// PR-level backstop for the same testing/E2E/visual-regression rules
// `.claude/hooks/pre-commit-quality-gate.js` enforces locally at commit time.
//
// Why this exists: the local hook only fires in a Claude Code session that
// has it installed, and can be bypassed with `--no-verify`, a commit made
// outside that session, or simply an environment (this repo's own cloud
// sandbox sessions, confirmed in docs/plans/2026-09-17-overnight-bugfix-log.md)
// where the hook was never wired up. This script re-checks the same rules
// over a PR's *full* commit range (not just its latest commit, which is all
// a single local `git commit` invocation could ever see), so a violation
// that slipped past (or around) the local hook still gets caught before
// merge.
//
// Rules checked (logic shared with the hook via ./lib/commit-rules.js so the
// two can never silently drift apart):
//
//   Rule 2 (fix/feat-needs-test): a `fix(` or `feat(` commit touching backend/
//     or frontend/ source must also touch a test file, or carry `Test-Exempt:`.
//   Rule 3 (UI-needs-visual-regression): a commit touching screens/components
//     must also touch maestro-flows/visual/*.yaml, or carry
//     `Visual-Regression-Exempt:`.
//   Rule 4 (UI-needs-real-E2E): a commit touching screens/components must
//     also touch e2e/, or carry `E2E-Exempt:`.
//
// Deliberately NOT checked (see CLAUDE.md's Compound Engineering workflow
// section, and the task that produced this script): whether /ce-brainstorm,
// /ce-plan, /ce-code-review, or /ce-compound actually ran. None of those are
// detectable from a git diff, and this repo's own CLAUDE.md explicitly
// declines to build a "blunt mechanical proxy" for them — respected here,
// not relitigated.
//
// Exit code: non-zero only when a rule is violated with NO exempt trailer.
// Commits that use an exempt trailer are reported, never treated as failures
// — the trailer is a legitimate, deliberate escape hatch (see
// docs/solutions/tooling-decisions/visual-regression-hook-uses-exempt-trailer-not-hard-block.md).

const { spawnSync } = require('child_process');
const {
  isScreenOrComponentTsx,
  isPlaywrightE2eFile,
  isMaestroVisualFile,
  isTestFile,
  isFixOrFeatCommit,
  extractTrailer,
} = require('./lib/commit-rules');

function isBackendOrFrontendSource(file) {
  return (
    (/^backend\/src\//.test(file) || /^frontend\/src\//.test(file)) &&
    !/\/__tests__\//.test(file) &&
    !/\.test\.tsx?$/.test(file)
  );
}

function run(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout;
}

// Returns [{ sha, subject, body, message, files }] for base..head, oldest first.
function getCommitRange(base, head, cwd) {
  const shas = run(['rev-list', '--reverse', `${base}..${head}`], cwd)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return shas.map((sha) => {
    const message = run(['log', '-1', '--format=%B', sha], cwd).replace(/\n+$/, '');
    const files = run(['diff-tree', '--no-commit-id', '--name-only', '-r', sha], cwd)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return { sha, message, files };
  });
}

// Evaluates the three rules for one commit. Returns { violations: [...], exemptions: [...] }.
function evaluateCommit(commit) {
  const { sha, message, files } = commit;
  const violations = [];
  const exemptions = [];

  const testExempt = extractTrailer(message, 'Test-Exempt');
  const visualExempt = extractTrailer(message, 'Visual-Regression-Exempt');
  const e2eExempt = extractTrailer(message, 'E2E-Exempt');

  const touchesBackendOrFrontendSource = files.some(isBackendOrFrontendSource);
  if (isFixOrFeatCommit(message) && touchesBackendOrFrontendSource) {
    const touchesTest = files.some(isTestFile);
    if (!touchesTest) {
      if (testExempt) {
        exemptions.push({ sha, rule: 'Test-Exempt', reason: testExempt });
      } else {
        violations.push({
          sha,
          rule: 'fix/feat needs a regression test',
          detail: 'fix(/feat( commit touches backend/frontend source but no test file, and no Test-Exempt trailer.',
        });
      }
    }
  }

  const touchesUi = files.some(isScreenOrComponentTsx);
  if (touchesUi) {
    const touchesVisual = files.some(isMaestroVisualFile);
    if (!touchesVisual) {
      if (visualExempt) {
        exemptions.push({ sha, rule: 'Visual-Regression-Exempt', reason: visualExempt });
      } else {
        violations.push({
          sha,
          rule: 'UI change needs a visual-regression baseline',
          detail:
            'Touches frontend/src/screens/** or frontend/src/components/** but no maestro-flows/visual/*.yaml, ' +
            'and no Visual-Regression-Exempt trailer.',
        });
      }
    }

    const touchesE2e = files.some(isPlaywrightE2eFile);
    if (!touchesE2e) {
      if (e2eExempt) {
        exemptions.push({ sha, rule: 'E2E-Exempt', reason: e2eExempt });
      } else {
        violations.push({
          sha,
          rule: 'UI change needs real Playwright E2E',
          detail: 'Touches frontend/src/screens/** or frontend/src/components/** but no e2e/ file, and no E2E-Exempt trailer.',
        });
      }
    }
  }

  return { violations, exemptions };
}

function auditRange(base, head, cwd) {
  const commits = getCommitRange(base, head, cwd);
  const allViolations = [];
  const allExemptions = [];
  for (const commit of commits) {
    const { violations, exemptions } = evaluateCommit(commit);
    allViolations.push(...violations);
    allExemptions.push(...exemptions);
  }
  return { commits, violations: allViolations, exemptions: allExemptions };
}

function formatSummary({ commits, violations, exemptions }) {
  const lines = [];
  lines.push('## Principles audit');
  lines.push('');
  lines.push(
    `Checked ${commits.length} commit(s) in this PR against this repo's fix/feat-needs-test, ` +
      'UI-needs-visual-regression, and UI-needs-real-E2E rules (see `.claude/hooks/pre-commit-quality-gate.js` ' +
      'and `.claude/scripts/audit-pr-principles.js`).'
  );
  lines.push('');

  if (violations.length === 0) {
    lines.push('No unexempted rule violations found.');
  } else {
    lines.push(`**${violations.length} unexempted violation(s):**`);
    lines.push('');
    for (const v of violations) {
      lines.push(`- \`${v.sha.slice(0, 7)}\` — ${v.rule}: ${v.detail}`);
    }
  }
  lines.push('');

  if (exemptions.length === 0) {
    lines.push('No exempt trailers were used in this PR.');
  } else {
    lines.push(`**${exemptions.length} exempt trailer(s) used** (legitimate escape hatch — informational, not a failure):`);
    lines.push('');
    for (const e of exemptions) {
      lines.push(`- \`${e.sha.slice(0, 7)}\` — \`${e.rule}\`: ${e.reason}`);
    }
  }
  lines.push('');
  lines.push(
    '_This job does not and cannot check whether `/ce-brainstorm`, `/ce-plan`, `/ce-code-review`, or ' +
      '`/ce-compound` actually ran — those are not detectable from a git diff. See CLAUDE.md._'
  );

  return lines.join('\n');
}

module.exports = {
  isBackendOrFrontendSource,
  getCommitRange,
  evaluateCommit,
  auditRange,
  formatSummary,
};

// CLI entrypoint: `node audit-pr-principles.js <base-sha-or-ref> <head-sha-or-ref> [cwd]`
if (require.main === module) {
  const [, , base, head, cwd] = process.argv;
  if (!base || !head) {
    console.error('Usage: audit-pr-principles.js <base> <head> [cwd]');
    process.exit(1);
  }

  const result = auditRange(base, head, cwd || process.cwd());
  const summary = formatSummary(result);
  console.log(summary);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    require('fs').appendFileSync(summaryPath, summary + '\n');
  }
  const outputPath = process.env.AUDIT_SUMMARY_FILE;
  if (outputPath) {
    require('fs').writeFileSync(outputPath, summary);
  }

  process.exit(result.violations.length > 0 ? 1 : 0);
}
