#!/usr/bin/env node
/**
 * SessionStart hook: removes agent/feature worktrees (and their local
 * branch) once the branch's PR has been MERGED, so finished worktrees
 * stop piling up (26 had accumulated by 2026-10-14).
 *
 * Removal is deliberately conservative -- a worktree is only removed when
 * ALL of these hold (see shouldRemove):
 *   - it lives under <main checkout>/.claude/worktrees/ and is not the
 *     checkout this session runs in
 *   - it is on a named branch (detached HEADs may hold unpushed work)
 *   - `git status --porcelain` is empty (no modified or untracked files)
 *   - it holds no git-ignored files other than regenerable build output
 *     (an ignored .env.local or notes file would be deleted with it)
 *   - its branch has a MERGED PR whose head commit equals the local HEAD
 *     (so no local commits were made after the PR merged)
 * Anything else is left alone; the stale-check hook still reports it.
 *
 * Every git/gh call has a timeout and the whole pass has a deadline, so a
 * hung network call cannot stall session start. Silent (exit 0) if
 * git/gh are unavailable or this is not a GitHub repo. Never uses --force:
 * git itself refuses to remove a dirty or locked worktree.
 *
 * Known limit: it cannot tell whether another live session has its cwd
 * inside a merged, clean worktree.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const CALL_TIMEOUT_MS = 20000;
const PASS_DEADLINE_MS = 60000;
const REGENERABLE_DIRS = ['node_modules', '.expo', 'dist', 'build', 'coverage'];

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      cwd,
      timeout: CALL_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

// `git status --porcelain --ignored` lists ignored paths as "!! <path>".
// Returns true when any ignored path is something other than regenerable output.
function hasIrreplaceableIgnored(statusOutput) {
  return statusOutput
    .split('\n')
    .filter((l) => l.startsWith('!! '))
    .map((l) => l.slice(3).replace(/\/$/, ''))
    .some((p) => !p.split('/').some((seg) => REGENERABLE_DIRS.includes(seg)));
}

function shouldRemove({ worktreePath, mainRoot, currentRoot, branch, status, mergedHeadSha, localHeadSha }) {
  const managedDir = path.join(mainRoot, '.claude', 'worktrees') + path.sep;
  if (!worktreePath.startsWith(managedDir)) return false;
  if (worktreePath === currentRoot) return false;
  if (!branch) return false;
  if (status === null || status === undefined) return false;
  if (status.split('\n').some((l) => l !== '' && !l.startsWith('!! '))) return false;
  if (hasIrreplaceableIgnored(status)) return false;
  if (!mergedHeadSha || !localHeadSha) return false;
  return mergedHeadSha === localHeadSha;
}

function listWorktrees(cwd) {
  const out = run('git', ['worktree', 'list', '--porcelain'], cwd) || '';
  return out.split('\n\n').filter(Boolean).map((block) => {
    const lines = block.split('\n');
    const pick = (prefix) => (lines.find((l) => l.startsWith(prefix)) || '').slice(prefix.length);
    return { path: pick('worktree '), branch: pick('branch refs/heads/') };
  });
}

function main() {
  const currentRoot = run('git', ['rev-parse', '--show-toplevel']);
  if (!currentRoot) return;
  const remote = run('git', ['remote', 'get-url', 'origin'], currentRoot);
  if (!remote || !remote.includes('github.com')) return;
  if (!run('gh', ['--version'])) return;

  // The first entry is always the main checkout, even when run from a linked worktree.
  const worktrees = listWorktrees(currentRoot);
  if (worktrees.length === 0) return;
  const mainRoot = worktrees[0].path;

  const deadline = Date.now() + PASS_DEADLINE_MS;
  const removed = [];
  for (const wt of worktrees.slice(1)) {
    if (Date.now() > deadline) break;
    if (!wt.branch) continue;
    // Cheap checks first; the slow ignored-file scan only runs for a worktree
    // that is otherwise ready to remove.
    if (run('git', ['status', '--porcelain'], wt.path) !== '') continue;
    const localHeadSha = run('git', ['rev-parse', 'HEAD'], wt.path);
    const mergedHeadSha = run('gh', [
      'pr', 'list', '--head', wt.branch, '--state', 'merged', '--json', 'headRefOid', '--jq', '.[0].headRefOid // empty',
    ], mainRoot);
    if (!mergedHeadSha || mergedHeadSha !== localHeadSha) continue;
    const status = run('git', ['status', '--porcelain', '--ignored'], wt.path);
    const decision = { worktreePath: wt.path, mainRoot, currentRoot, branch: wt.branch, status, mergedHeadSha, localHeadSha };
    if (!shouldRemove(decision)) continue;
    if (run('git', ['worktree', 'remove', wt.path], mainRoot) === null) continue;
    const branchGone = run('git', ['branch', '-D', wt.branch], mainRoot) !== null;
    removed.push(`${path.basename(wt.path)} (${wt.branch}${branchGone ? '' : ', local branch NOT deleted'})`);
  }

  if (removed.length > 0) {
    console.log(`Worktree cleanup: removed ${removed.length} worktree(s) whose PR is merged: ${removed.join(', ')}.`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch {
    // Housekeeping must never block or error a session start.
  }
}

module.exports = { shouldRemove, hasIrreplaceableIgnored };
