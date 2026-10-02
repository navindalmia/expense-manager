#!/usr/bin/env node
/**
 * SessionStart hook: flags stale git state in this repo so a new session
 * starts with an accurate picture instead of silently accumulating
 * tech debt across sessions (worktrees left behind, branches nobody
 * cleaned up, PRs sitting open for weeks).
 *
 * Deliberately SURFACES findings only -- never deletes or closes
 * anything itself. A branch that `git branch --no-merged` calls
 * "unmerged" is often a false positive (squash-merged PRs look
 * unmerged to git even though the work landed) -- this script
 * disambiguates via `gh pr list --search "head:<branch>"` before
 * calling anything a real orphan, per the project's own established
 * manual-audit methodology (see PROJECT_MEMORY / ai_workflow memory,
 * "git branch --no-merged master" checks from past sessions).
 *
 * Runs on SessionStart. Silent (exit 0, no output) if gh/git aren't
 * available or this isn't a git repo with a GitHub remote -- never
 * blocks a session from starting over a network hiccup.
 */

const { execSync } = require('child_process');

const STALE_PR_DAYS = 14;

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function main() {
  // Bail out quietly if this isn't a usable git+gh repo -- a hook that
  // errors on every session in every other repo would be worse than one
  // that does nothing outside its intended context.
  const repoRoot = sh('git rev-parse --show-toplevel');
  if (!repoRoot) return;
  const remote = sh('git remote get-url origin');
  if (!remote || !remote.includes('github.com')) return;
  if (!sh('gh --version')) return;

  const findings = [];

  // 1. Stray worktrees (excluding the main checkout).
  const worktreeList = sh('git worktree list --porcelain') || '';
  const worktrees = worktreeList
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const pathLine = block.split('\n').find((l) => l.startsWith('worktree '));
      return pathLine ? pathLine.replace('worktree ', '') : null;
    })
    .filter(Boolean);
  const strayWorktrees = worktrees.filter((w) => w !== repoRoot);
  if (strayWorktrees.length > 0) {
    findings.push(
      `${strayWorktrees.length} worktree(s) beyond the main checkout: ${strayWorktrees.join(', ')}. ` +
      `Check \`git -C <path> status\` for uncommitted work before removing with \`git worktree remove <path>\`.`
    );
  }

  // 2. Branches git thinks are unmerged into master, disambiguated via gh.
  sh('git fetch origin --prune');
  const unmergedRaw = sh('git branch -r --no-merged origin/master') || '';
  const unmergedBranches = unmergedRaw
    .split('\n')
    .map((l) => l.trim().replace(/^origin\//, ''))
    .filter((l) => l && !l.startsWith('HEAD'));

  const realOrphans = [];
  const staleOpenPrs = [];
  const now = Date.now();

  for (const branch of unmergedBranches) {
    const prJson = sh(`gh pr list --search "head:${branch}" --state all --json number,state,createdAt,title --limit 5`);
    if (!prJson) continue;
    let prs;
    try {
      prs = JSON.parse(prJson);
    } catch {
      continue;
    }

    if (prs.length === 0) {
      // No PR at all, ever, for this branch -- a genuine orphan, not a
      // squash-merge false positive.
      realOrphans.push(branch);
      continue;
    }

    const merged = prs.find((p) => p.state === 'MERGED');
    if (merged) continue; // False positive: squash-merged, safe, not an orphan.

    const open = prs.find((p) => p.state === 'OPEN');
    if (open) {
      const ageDays = Math.floor((now - new Date(open.createdAt).getTime()) / 86400000);
      if (ageDays >= STALE_PR_DAYS) {
        staleOpenPrs.push(`#${open.number} "${open.title}" (${ageDays}d open, branch ${branch})`);
      }
      continue;
    }

    // Only CLOSED (not merged) PRs exist for this branch -- the branch
    // itself is still real orphaned work if it wasn't merged any other way.
    realOrphans.push(branch);
  }

  if (realOrphans.length > 0) {
    findings.push(
      `${realOrphans.length} branch(es) with no merged PR at all -- real orphans, not squash-merge false positives: ${realOrphans.join(', ')}. ` +
      `Verify \`git log <branch> -5\` and \`git diff origin/master...<branch>\` before deciding whether to open a PR or delete.`
    );
  }

  if (staleOpenPrs.length > 0) {
    findings.push(
      `${staleOpenPrs.length} PR(s) open ${STALE_PR_DAYS}+ days, waiting on review/merge: ${staleOpenPrs.join('; ')}.`
    );
  }

  if (findings.length === 0) return;

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        `STALE GIT STATE CHECK (session-start-stale-check.js): ${findings.length} finding(s) in ${repoRoot}. ` +
        `Surface these to the user early in the session rather than acting on them unprompted -- this hook only reports, it never deletes/closes anything.\n\n` +
        findings.map((f, i) => `${i + 1}. ${f}`).join('\n'),
    },
  };
  console.log(JSON.stringify(output));
}

main();
