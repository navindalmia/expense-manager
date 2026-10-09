#!/usr/bin/env node
/**
 * SessionStart hook: puts the two things a session most often forgets to read
 * in front of the model at the start of every session -- the latest handoff
 * note in Claude's project memory, and the docs/solutions/ knowledge store.
 *
 * Why: neither is read automatically. A session that starts with "where were
 * we", "the env is down" or "phone shows an error" otherwise re-derives facts
 * that are already written down (SDK version of the phone's Expo Go, LAN IP
 * drift, which worktree runs the backend, ...).
 *
 * SURFACES pointers only. Silent (exit 0, no output) if the memory folder or
 * docs/solutions/ is missing, so it never blocks or errors a session.
 *
 * The memory folder is pinned to the Windows-style key on every OS (see the
 * "Cross-Machine Project Folder Pinning" rule in ~/.claude/CLAUDE.md).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const MEMORY_PARTS = path.join(
  os.homedir(),
  '.claude',
  'projects',
  'C--nd-repos-expense-manager',
  'memory',
  'project_context'
);

/** Newest handoff part, by its numeric NN- filename prefix. */
function latestHandoff(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const parts = names
    .map((name) => ({ name, n: parseInt(name.split('-')[0], 10) }))
    .filter((p) => Number.isInteger(p.n) && p.name.endsWith('.md'))
    .sort((a, b) => b.n - a.n);
  return parts.length > 0 ? path.join(dir, parts[0].name) : null;
}

function countSolutions(root) {
  const dir = path.join(root, 'docs', 'solutions');
  let total = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(d, entry.name));
      else if (entry.name.endsWith('.md')) total += 1;
    }
  };
  try {
    walk(dir);
  } catch {
    return 0;
  }
  return total;
}

function main() {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const handoff = latestHandoff(MEMORY_PARTS);
  const solutions = countSolutions(root);
  if (!handoff && solutions === 0) return;

  const lines = ['RECALL (session-start-recall.js): read these before acting, not after.'];
  if (handoff) {
    lines.push(
      `- Latest handoff note: ${handoff}. Read it first for "where were we", dev-env, phone or CI questions; it records the phone's Expo Go SDK, the LAN-IP drift, which worktree runs what, and the exact next steps.`
    );
  }
  if (solutions > 0) {
    lines.push(
      `- docs/solutions/ holds ${solutions} documented fixes (YAML frontmatter: module, tags, problem_type). Grep it for the symptom or component before debugging or doing environment work.`
    );
  }
  process.stdout.write(lines.join('\n') + '\n');
}

main();
