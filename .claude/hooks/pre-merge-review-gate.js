#!/usr/bin/env node
// Blocks `gh pr merge` until a real /ce-code-review run has left a receipt for the PR's
// CURRENT head commit. The review skill writes <scratch>/ce-code-review/<run>/metadata.json
// with head_sha and verdict; this gate looks for one whose head_sha equals the PR head.
// A new commit after the review changes the head, so a stale review does not count.
//
// Why: CLAUDE.md makes /ce-code-review mandatory but it cannot be seen in a git diff, and
// a merge went through without it (PR #166, 2026-11-01). This closes that gap for Claude's
// own merges only; the repo owner merging in the GitHub UI is unaffected.
//
// Fails CLOSED: if the PR head cannot be resolved the merge is blocked, with the reason.
// Exit 2 + stderr = block (Claude Code hook contract).
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parsePrMerge } = require('./lib/is-pr-merge');

// Only a passing verdict counts; "Not ready" must not unlock a merge.
const ACCEPTED_VERDICTS = new Set(['Ready to merge', 'Ready with fixes']);

function receiptRoots(env) {
  if (env.CE_REVIEW_RECEIPT_DIRS) return env.CE_REVIEW_RECEIPT_DIRS.split(path.delimiter).filter(Boolean);
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  const roots = [`/tmp/compound-engineering-${uid}`, path.join(os.tmpdir(), `compound-engineering-${uid}`)];
  return [...new Set(roots)];
}

function hasReceipt(headSha, roots) {
  for (const root of roots) {
    const base = path.join(root, 'ce-code-review');
    let runs = [];
    try { runs = fs.readdirSync(base); } catch { continue; }
    for (const run of runs) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(base, run, 'metadata.json'), 'utf8'));
        if (meta && meta.head_sha === headSha && ACCEPTED_VERDICTS.has(meta.verdict)) return run;
      } catch { /* unreadable run dir: not a receipt */ }
    }
  }
  return null;
}

function prHead({ selector, repo, env }, cwd) {
  const args = ['pr', 'view'];
  if (selector) args.push(selector);
  if (repo) args.push('-R', repo);
  args.push('--json', 'headRefOid', '-q', '.headRefOid');
  const timeout = Number(process.env.CE_GH_TIMEOUT_MS) || 20000;
  const r = spawnSync('gh', args, { encoding: 'utf8', cwd, timeout, killSignal: 'SIGKILL', env: { ...process.env, ...(env || {}) } });
  if (r.error) return ''; // ENOENT, ETIMEDOUT: unresolved head, so decide() blocks
  return r.status === 0 && r.stdout ? r.stdout.trim() : '';
}

const label = (p) => (p.selector || '(current branch)') + (p.repo ? ` in ${p.repo}` : '');

function decide(command, { headSha, roots }) {
  const p = parsePrMerge(command);
  if (p === null) return { block: false };
  if (p.unsupported) return { block: true, reason: p.unsupported };
  if (p.api && !p.selector) return { block: true, reason: 'gh api PR merge with an unresolvable PR number; use `gh pr merge <n>` after a /ce-code-review receipt exists' };
  if (!headSha) return { block: true, reason: `could not resolve the head commit of PR ${label(p)}; refusing to merge without a review receipt` };
  if (hasReceipt(headSha, roots)) return { block: false };
  return {
    block: true,
    reason: `no passing /ce-code-review receipt for PR ${label(p)} head ${headSha.slice(0, 7)}. Run the real /ce-code-review on this exact head (a new commit invalidates an earlier review), then merge.`,
  };
}

function main() {
  // The harness always sends valid JSON. If it is unreadable, fail closed only when the
  // raw text looks like a merge (contains both 'gh' and 'merge'); otherwise allow.
  let raw = '';
  let input = null;
  try { raw = fs.readFileSync(0, 'utf8'); input = JSON.parse(raw); } catch { /* handled below */ }
  if (!input || typeof input !== 'object') {
    if (raw.includes('gh') && raw.includes('merge')) {
      process.stderr.write('PRE-MERGE REVIEW GATE: unparseable hook input that mentions gh and merge; refusing\n');
      process.exit(2);
    }
    process.exit(0);
  }
  const command = input.tool_input && input.tool_input.command;
  const p = parsePrMerge(command);
  if (p === null) process.exit(0);
  const headSha = p.unsupported || (p.api && !p.selector) ? '' : prHead(p, input.cwd || process.cwd());
  const out = decide(command, { headSha, roots: receiptRoots(process.env) });
  if (out.block) { process.stderr.write(`PRE-MERGE REVIEW GATE: ${out.reason}\n`); process.exit(2); }
  process.exit(0);
}

if (require.main === module) main();
module.exports = { decide, hasReceipt, receiptRoots, prHead };
