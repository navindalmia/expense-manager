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
        if (meta && meta.head_sha === headSha && typeof meta.verdict === 'string' && meta.verdict) return run;
      } catch { /* unreadable run dir: not a receipt */ }
    }
  }
  return null;
}

function prHead(selector, cwd) {
  const args = ['pr', 'view'];
  if (selector) args.push(selector);
  args.push('--json', 'headRefOid', '-q', '.headRefOid');
  const r = spawnSync('gh', args, { encoding: 'utf8', cwd });
  return r.status === 0 ? r.stdout.trim() : '';
}

function decide(command, { headSha, roots }) {
  const selector = parsePrMerge(command);
  if (selector === null) return { block: false };
  if (!headSha) return { block: true, reason: `could not resolve the head commit of PR ${selector || '(current branch)'}; refusing to merge without a review receipt` };
  if (hasReceipt(headSha, roots)) return { block: false };
  return {
    block: true,
    reason: `no /ce-code-review receipt for PR ${selector || '(current branch)'} head ${headSha.slice(0, 7)}. Run the real /ce-code-review on this exact head (a new commit invalidates an earlier review), then merge.`,
  };
}

function main() {
  let input = {};
  try { const raw = fs.readFileSync(0, 'utf8'); input = raw ? JSON.parse(raw) : {}; } catch { /* treat as no input */ }
  const command = input.tool_input && input.tool_input.command;
  const selector = parsePrMerge(command);
  if (selector === null) process.exit(0);
  const headSha = prHead(selector, input.cwd || process.cwd());
  const out = decide(command, { headSha, roots: receiptRoots(process.env) });
  if (out.block) { process.stderr.write(`PRE-MERGE REVIEW GATE: ${out.reason}\n`); process.exit(2); }
  process.exit(0);
}

if (require.main === module) main();
module.exports = { decide, hasReceipt, receiptRoots };
