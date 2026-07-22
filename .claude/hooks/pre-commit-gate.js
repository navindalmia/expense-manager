#!/usr/bin/env node
// Deterministic pre-commit gate: blocks `git commit` unless backend `tsc --noEmit` passes.
// Cross-platform (plain Node, no shell script) so it runs the same on macOS and Windows.
// Fails OPEN (allows the commit) if tooling is missing, so a broken dev environment
// never blocks every commit in every repo the way the old prompt-based hook did.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
const backendDir = path.join(projectDir, 'backend');
const tscBin = path.join(backendDir, 'node_modules', 'typescript', 'bin', 'tsc');

if (!fs.existsSync(tscBin)) {
  console.error('[pre-commit-gate] backend/node_modules/typescript not found — skipping tsc check (failing open).');
  process.exit(0);
}

const result = spawnSync(process.execPath, [tscBin, '--noEmit'], {
  cwd: backendDir,
  encoding: 'utf8',
});

if (result.error) {
  console.error(`[pre-commit-gate] could not run tsc (${result.error.message}) — skipping check (failing open).`);
  process.exit(0);
}

if (result.status !== 0) {
  console.error('[pre-commit-gate] BLOCKED: backend `npx tsc --noEmit` is failing. Fix these errors before committing:\n');
  console.error(result.stdout || result.stderr);
  process.exit(2);
}

process.exit(0);
