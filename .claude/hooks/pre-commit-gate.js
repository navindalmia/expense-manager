#!/usr/bin/env node
// Deterministic pre-commit gate: blocks `git commit` unless `tsc --noEmit` passes
// for every TypeScript project found in the repo actually being committed to.
// Cross-platform (plain Node, no shell script) so it runs the same on macOS and Windows.
//
// Repo-aware: this hook is registered in expense-manager's .claude/settings.json, but
// the matcher ("Bash(git commit*)") only inspects the command text, not which repo it
// targets. A command like `git -C /some/other/repo commit` still matches. So this script
// resolves the ACTUAL target repo from the command (or falls back to the hook's cwd),
// and only checks TypeScript projects that exist inside that repo. If the target repo has
// no tsconfig.json at all, the check is skipped entirely rather than checking the wrong
// repo's TypeScript.
//
// Fails OPEN (allows the commit) whenever it can't determine what to check or the
// tooling isn't installed, so a broken dev environment never blocks every commit.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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
  return dir;
}

// Shallow scan (repo root + one level down) for tsconfig.json, skipping node_modules.
function findTsProjects(repoRoot) {
  const found = [];
  const levels = [repoRoot];
  for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
      levels.push(path.join(repoRoot, entry.name));
    }
  }
  for (const dir of levels) {
    const tsconfig = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(tsconfig)) found.push(dir);
  }
  return found;
}

function findTscBin(projectDir, repoRoot) {
  const local = path.join(projectDir, 'node_modules', 'typescript', 'bin', 'tsc');
  if (fs.existsSync(local)) return local;
  const hoisted = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  if (fs.existsSync(hoisted)) return hoisted;
  return null;
}

const hookInput = readStdinJson();
const targetDir = resolveTargetDir(hookInput);
const repoRoot = resolveRepoRoot(targetDir);
const tsProjects = findTsProjects(repoRoot);

if (tsProjects.length === 0) {
  process.exit(0); // not a TypeScript repo (or none detected) — nothing to check
}

const failures = [];

for (const projectDir of tsProjects) {
  const tscBin = findTscBin(projectDir, repoRoot);
  if (!tscBin) {
    console.error(`[pre-commit-gate] ${path.relative(repoRoot, projectDir) || '.'}: tsconfig.json found but no installed typescript — skipping (failing open).`);
    continue;
  }

  const result = spawnSync(process.execPath, [tscBin, '--noEmit'], { cwd: projectDir, encoding: 'utf8' });

  if (result.error) {
    console.error(`[pre-commit-gate] ${path.relative(repoRoot, projectDir) || '.'}: could not run tsc (${result.error.message}) — skipping (failing open).`);
    continue;
  }

  if (result.status !== 0) {
    failures.push({ projectDir, output: result.stdout || result.stderr });
  }
}

if (failures.length > 0) {
  console.error('[pre-commit-gate] BLOCKED: tsc --noEmit is failing. Fix these errors before committing:\n');
  for (const f of failures) {
    console.error(`--- ${path.relative(repoRoot, f.projectDir) || '.'} ---`);
    console.error(f.output);
  }
  process.exit(2);
}

process.exit(0);
