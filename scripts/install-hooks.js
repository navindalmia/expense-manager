#!/usr/bin/env node
// Sets core.hooksPath=.githooks. Safe no-op outside a git repo, in CI, or when another hooksPath is already configured.
const { spawnSync } = require('child_process');

/** Pure decision. Returns 'install' | 'skip-no-repo' | 'skip-ci' | 'skip-foreign' | 'already'. */
function decideInstall({ inRepo, current, ci }) {
  if (ci) return 'skip-ci';
  if (!inRepo) return 'skip-no-repo';
  if (current && current !== '.githooks') return 'skip-foreign';
  return current === '.githooks' ? 'already' : 'install';
}

function main() {
  const inRepo = spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });
  const ok = !inRepo.error && inRepo.status === 0;
  const cur = ok ? spawnSync('git', ['config', '--get', 'core.hooksPath'], { encoding: 'utf8' }) : null;
  const current = cur && cur.status === 0 ? cur.stdout.trim() : '';
  const decision = decideInstall({ inRepo: ok, current, ci: process.env.CI === 'true' });
  if (decision === 'install') spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  if (decision === 'skip-foreign') {
    console.warn(`[hooks] core.hooksPath is already "${current}"; NOT overwriting. The regression-pack hooks in .githooks/ will not run locally (CI still enforces them).`);
  }
  return decision;
}

module.exports = { decideInstall };
if (require.main === module) main();
