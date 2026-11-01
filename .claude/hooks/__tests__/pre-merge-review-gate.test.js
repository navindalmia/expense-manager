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

test('parsePrMerge reads selector and repo from plain, flagged and compound forms', () => {
  const sel = (c) => { const p = parsePrMerge(c); return p && p.selector; };
  assert.equal(sel('gh pr merge 166 --squash'), '166');
  assert.equal(sel('gh pr merge --squash 165'), '165');
  assert.equal(sel('echo a && gh pr merge 7 --squash && echo ok'), '7');
  assert.equal(sel('gh pr merge --squash'), '');
  assert.equal(sel('gh pr merge https://github.com/o/r/pull/9 --squash'), 'https://github.com/o/r/pull/9');
  assert.equal(sel('gh pr merge feature/x --squash'), 'feature/x');
  assert.equal(sel('gh pr merge -b "fixes 12" --squash'), '');
  assert.equal(sel('gh pr merge 5 -b "fixes 12"'), '5');
  assert.equal(sel('gh pr merge --subject s -F body.md 8'), '8');
  assert.equal(parsePrMerge('gh pr merge 5 -R o/r').repo, 'o/r');
  assert.equal(parsePrMerge('gh pr merge 5 --repo=o/r').repo, 'o/r');
  assert.equal(parsePrMerge('gh -R o/r pr merge 5').repo, 'o/r');
  assert.equal(parsePrMerge('gh --repo o/r pr merge 5').selector, '5');
  assert.equal(parsePrMerge('"gh" pr merge 5').selector, '5');
  assert.equal(parsePrMerge('gh pr view 166'), null);
  assert.equal(parsePrMerge('echo hello'), null);
});

test('parsePrMerge detects gh api merge endpoints', () => {
  const p = parsePrMerge('gh api -X PUT repos/o/r/pulls/42/merge');
  assert.deepEqual(p, { selector: '42', repo: 'o/r', api: true, env: {} });
  assert.equal(parsePrMerge('gh api repos/o/r/pulls/$N/merge').selector, '');
});

test('should block gh api merge whose PR number cannot be resolved', () => {
  const out = decide('gh api repos/o/r/pulls/$N/merge', { headSha: 'x', roots: [] });
  assert.equal(out.block, true);
});

test('should block when the receipt verdict is Not ready', () => {
  const roots = receipts({ r1: { head_sha: 'abc1234', verdict: 'Not ready' } });
  assert.equal(decide('gh pr merge 1', { headSha: 'abc1234', roots }).block, true);
});

test('should allow a non-merge command without any lookup', () => {
  assert.equal(decide('gh pr view 1', { headSha: '', roots: [] }).block, false);
});

test('should block a merge when no review receipt exists for the PR head', () => {
  const out = decide('gh pr merge 166 --squash', { headSha: 'abc1234def', roots: receipts({}) });
  assert.equal(out.block, true);
  assert.match(out.reason, /no passing \/ce-code-review receipt/);
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

// --- main()/exit-code contract via a real child process and a fake gh ---
const { spawnSync } = require('node:child_process');
const HOOK = path.join(__dirname, '..', 'pre-merge-review-gate.js');

function fakeGh(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fakegh-'));
  const log = path.join(dir, 'args.log');
  fs.writeFileSync(path.join(dir, 'gh'), `#!/bin/sh\necho "$@" >> "${log}"\n${body}\n`, { mode: 0o755 });
  return { dir, log };
}

function runHook(stdin, { pathDir, roots, extraEnv } = {}) {
  const env = { ...process.env, CE_REVIEW_RECEIPT_DIRS: (roots || []).join(path.delimiter), ...extraEnv };
  env.PATH = pathDir === undefined ? process.env.PATH : pathDir;
  return spawnSync(process.execPath, [HOOK], { input: stdin, encoding: 'utf8', env });
}

const bash = (command) => JSON.stringify({ tool_input: { command }, cwd: os.tmpdir() });

test('main exits 0 for non-merge commands', () => {
  assert.equal(runHook(bash('ls -la')).status, 0);
});

test('main exits 2 without a receipt and 0 with one (CE_REVIEW_RECEIPT_DIRS honoured)', () => {
  const gh = fakeGh('echo abc1234');
  const none = runHook(bash('gh pr merge 9 --squash'), { pathDir: `${gh.dir}:${process.env.PATH}`, roots: receipts({}) });
  assert.equal(none.status, 2);
  assert.match(none.stderr, /PRE-MERGE REVIEW GATE/);
  const roots = receipts({ r1: { head_sha: 'abc1234', verdict: 'Ready to merge' } });
  assert.equal(runHook(bash('gh pr merge 9 --squash'), { pathDir: `${gh.dir}:${process.env.PATH}`, roots }).status, 0);
});

test('main passes URL, branch, number and -R/--repo straight to gh pr view', () => {
  const roots = receipts({ r1: { head_sha: 'abc1234', verdict: 'Ready with fixes' } });
  const cases = [
    ['gh pr merge https://github.com/o/r/pull/9 --squash', 'pr view https://github.com/o/r/pull/9 --json'],
    ['gh pr merge feature/x', 'pr view feature/x --json'],
    ['gh pr merge 5 -b "fixes 12"', 'pr view 5 --json'],
    ['gh -R o/r pr merge 5', 'pr view 5 -R o/r --json'],
    ['gh --repo o/r pr merge 5', 'pr view 5 -R o/r --json'],
    ['gh pr merge 5 --repo o/r', 'pr view 5 -R o/r --json'],
  ];
  for (const [cmd, expected] of cases) {
    const gh = fakeGh('echo abc1234');
    const r = runHook(bash(cmd), { pathDir: `${gh.dir}:${process.env.PATH}`, roots });
    assert.equal(r.status, 0, cmd + r.stderr);
    assert.ok(fs.readFileSync(gh.log, 'utf8').startsWith(expected), `${cmd} -> ${fs.readFileSync(gh.log, 'utf8')}`);
  }
});

test('main fails closed when gh is missing or errors (prHead)', () => {
  const missing = runHook(bash('gh pr merge 9'), { pathDir: '/nonexistent', roots: receipts({}) });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /could not resolve/);
  const failing = fakeGh('exit 1');
  assert.equal(runHook(bash('gh pr merge 9'), { pathDir: failing.dir, roots: receipts({}) }).status, 2);
});

test('main blocks gh api merge with an unresolvable PR number', () => {
  const r = runHook(bash('gh api repos/o/r/pulls/$N/merge'), { roots: receipts({}) });
  assert.equal(r.status, 2);
});

test('main on malformed stdin exits 2 only when it mentions gh and merge', () => {
  assert.equal(runHook('gh pr merge 5 {not json').status, 2);
  assert.equal(runHook('').status, 0);
  assert.equal(runHook('garbage').status, 0);
});

// --- nested/obfuscated forms, env/cd prefixes, other merge routes, timeout ---
test('parsePrMerge sees merges inside nested shells and obfuscation', () => {
  const cases = [
    'bash -c "gh pr merge 5 --squash"', "sh -c 'gh pr merge 5'", 'eval "gh pr merge 5"', 'eval gh pr merge 5',
    '(gh pr merge 5)', 'echo $(gh pr merge 5)', '`gh pr merge 5`', '{ gh pr merge 5; }',
    '\\gh pr merge 5', 'gh \\\npr merge 5', 'bash -lc "cd x && gh pr merge 5 -R o/r"',
  ];
  for (const c of cases) {
    const p = parsePrMerge(c);
    assert.ok(p && !p.unsupported, `not detected: ${c}`);
    assert.equal(p.selector, '5', c);
  }
});

test('parsePrMerge does not flag mentions of a merge inside plain quoted text', () => {
  assert.equal(parsePrMerge('git commit -m "docs: gh pr merge is gated"'), null);
  assert.equal(parsePrMerge('echo "gh pr merge 5"'), null);
});

test('parsePrMerge fails closed on an unbalanced quote that mentions a merge', () => {
  assert.match(parsePrMerge("echo it's; gh pr merge 5").unsupported, /unbalanced quote/);
  assert.equal(parsePrMerge("echo it's fine"), null);
});

test('parsePrMerge reads GH_REPO/GH_HOST prefixes into repo and env', () => {
  const p = parsePrMerge('GH_REPO=o/r GH_HOST=h.example gh pr merge 5');
  assert.equal(p.repo, 'o/r');
  assert.equal(p.env.GH_HOST, 'h.example');
});

test('parsePrMerge fails closed when cd/pushd or export GH_REPO precedes the merge without -R or URL', () => {
  assert.match(parsePrMerge('cd /x && gh pr merge 5').unsupported, /cd\/pushd/);
  assert.match(parsePrMerge('pushd /x; gh pr merge 5').unsupported, /cd\/pushd/);
  assert.match(parsePrMerge('export GH_REPO=o/r; gh pr merge 5').unsupported, /GH_REPO/);
  assert.equal(parsePrMerge('cd /x && gh pr merge 5 -R o/r').repo, 'o/r');
  assert.equal(parsePrMerge('cd /x && gh pr merge https://github.com/o/r/pull/5').selector, 'https://github.com/o/r/pull/5');
});

test('parsePrMerge blocks graphql and curl merge routes', () => {
  assert.match(parsePrMerge('gh api graphql -f query="mutation { mergePullRequest(input:{pullRequestId:\\"x\\"}) { clientMutationId } }"').unsupported, /graphql/);
  assert.match(parsePrMerge('curl -X PUT https://api.github.com/repos/o/r/pulls/5/merge').unsupported, /curl/);
  assert.equal(parsePrMerge('curl https://example.com'), null);
});

test('decide blocks an unsupported merge form with its reason, without a head lookup', () => {
  const out = decide('cd /x && gh pr merge 5', { headSha: 'abc', roots: receipts({ r: { head_sha: 'abc', verdict: 'Ready to merge' } }) });
  assert.equal(out.block, true);
  assert.match(out.reason, /cd\/pushd/);
});

test('main exits 2 for nested bash -c merge, cd prefix and curl merge', () => {
  const roots = receipts({ r1: { head_sha: 'abc1234', verdict: 'Ready to merge' } });
  const gh = fakeGh('echo abc1234');
  const pathDir = `${gh.dir}:${process.env.PATH}`;
  assert.equal(runHook(bash('bash -c "gh pr merge 9"'), { pathDir, roots: receipts({}) }).status, 2);
  assert.equal(runHook(bash('bash -c "gh pr merge 9"'), { pathDir, roots }).status, 0);
  assert.equal(runHook(bash('cd /tmp && gh pr merge 9'), { pathDir, roots }).status, 2);
  assert.equal(runHook(bash('curl -X PUT https://api.github.com/repos/o/r/pulls/9/merge'), { pathDir, roots }).status, 2);
});

test('main passes GH_REPO/GH_HOST prefixes to gh through the spawn env', () => {
  const roots = receipts({ r1: { head_sha: 'abc1234', verdict: 'Ready to merge' } });
  const gh = fakeGh('echo "$GH_HOST" >> "$0.host"; echo abc1234');
  const r = runHook(bash('GH_REPO=o/r GH_HOST=h.example gh pr merge 5'), { pathDir: `${gh.dir}:${process.env.PATH}`, roots });
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(gh.dir, 'gh.host'), 'utf8'), /h\.example/);
  assert.ok(fs.readFileSync(gh.log, 'utf8').includes('-R o/r'));
});

test('main fails closed when gh hangs past the timeout', () => {
  const roots = receipts({ r1: { head_sha: 'abc1234', verdict: 'Ready to merge' } });
  const gh = fakeGh('sleep 20; echo abc1234');
  const t0 = Date.now();
  const r = runHook(bash('gh pr merge 9'), { pathDir: `${gh.dir}:${process.env.PATH}`, roots, extraEnv: { CE_GH_TIMEOUT_MS: '300' } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /could not resolve/);
  assert.ok(Date.now() - t0 < 10000);
});

test('settings.json gives the merge gate hook a timeout', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'settings.json'), 'utf8'));
  const hooks = JSON.stringify(cfg.hooks);
  const m = /pre-merge-review-gate\.js[^}]*?"timeout":\s*(\d+)/.exec(hooks);
  assert.ok(m && Number(m[1]) >= 25 && Number(m[1]) <= 60);
});
