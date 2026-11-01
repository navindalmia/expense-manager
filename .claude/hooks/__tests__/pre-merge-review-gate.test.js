// Run: node --test .claude/hooks/__tests__/pre-merge-review-gate.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parsePrMerge } = require('../lib/is-pr-merge');
const { decide } = require('../pre-merge-review-gate');

function receipts(runs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'receipts-'));
  for (const [name, meta] of Object.entries(runs)) {
    const d = path.join(root, 'ce-code-review', name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'metadata.json'), JSON.stringify(meta));
  }
  return [root];
}

test('parsePrMerge reads the PR number from plain, flagged and compound forms', () => {
  assert.equal(parsePrMerge('gh pr merge 166 --squash'), '166');
  assert.equal(parsePrMerge('gh pr merge --squash 165'), '165');
  assert.equal(parsePrMerge('cd x && gh pr merge 7 --squash && echo ok'), '7');
  assert.equal(parsePrMerge('gh pr merge --squash'), '');
  assert.equal(parsePrMerge('gh pr view 166'), null);
  assert.equal(parsePrMerge('echo hello'), null);
});

test('should allow a non-merge command without any lookup', () => {
  assert.equal(decide('gh pr view 1', { headSha: '', roots: [] }).block, false);
});

test('should block a merge when no review receipt exists for the PR head', () => {
  const out = decide('gh pr merge 166 --squash', { headSha: 'abc1234def', roots: receipts({}) });
  assert.equal(out.block, true);
  assert.match(out.reason, /no \/ce-code-review receipt/);
});

test('should block when the only receipt is for an older head (stale review)', () => {
  const roots = receipts({ r1: { head_sha: 'old0000', verdict: 'Ready to merge' } });
  assert.equal(decide('gh pr merge 166', { headSha: 'new1111', roots }).block, true);
});

test('should block when a receipt matches the head but carries no verdict', () => {
  const roots = receipts({ r1: { head_sha: 'abc1234' } });
  assert.equal(decide('gh pr merge 166', { headSha: 'abc1234', roots }).block, true);
});

test('should allow a merge when a receipt with a verdict matches the PR head', () => {
  const roots = receipts({ r1: { head_sha: 'abc1234', verdict: 'Ready with fixes' } });
  assert.equal(decide('gh pr merge 166 --squash', { headSha: 'abc1234', roots }).block, false);
});

test('should fail closed when the PR head cannot be resolved', () => {
  const out = decide('gh pr merge 166', { headSha: '', roots: receipts({}) });
  assert.equal(out.block, true);
  assert.match(out.reason, /could not resolve/);
});
