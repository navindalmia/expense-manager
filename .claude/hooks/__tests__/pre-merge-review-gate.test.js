// Run: node --test .claude/hooks/__tests__/pre-merge-review-gate.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { classify } = require('../lib/is-pr-merge');
const { check, hasReceipt, receiptRoots, prHead } = require('../pre-merge-review-gate');

const HOOK = path.join(__dirname, '..', 'pre-merge-review-gate.js');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

function receipts(runs) {
  const root = tmp('receipts-');
  for (const [name, meta] of Object.entries(runs)) {
    const d = path.join(root, 'ce-code-review', name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'metadata.json'), typeof meta === 'string' ? meta : JSON.stringify(meta));
  }
  return [root];
}

// --- classify: the allowlist ---
test('classify ignores commands that do not mention gh and merge', () => {
  for (const c of ['ls -la', 'gh pr view 5', 'git merge main', 'echo hello', 'gh pr checks 5']) {
    assert.equal(classify(c).kind, 'none', c);
  }
  assert.equal(classify(undefined).kind, 'none');
});

test('classify accepts only the plain single gh pr merge form', () => {
  const ok = [
    ['gh pr merge 166 --squash', '166', ''],
    ['gh pr merge --squash 165', '165', ''],
    ['gh pr merge https://github.com/o/r/pull/9 --squash', 'https://github.com/o/r/pull/9', ''],
    ['gh pr merge feature/x -d', 'feature/x', ''],
    ['gh pr merge 5 -R o/r', '5', 'o/r'],
    ['gh pr merge 5 --repo=o/r --squash', '5', 'o/r'],
    ['gh pr merge 5 --squash -F body.md --match-head-commit abc1234', '5', ''],
    ['  gh pr merge 7  ', '7', ''],
  ];
  for (const [cmd, selector, repo] of ok) {
    assert.deepEqual(classify(cmd), { kind: 'simple', selector, repo }, cmd);
  }
});

test('classify blocks chained, nested, indirect and obfuscated merges', () => {
  const bad = [
    'echo a && gh pr merge 5', 'gh pr merge 5; echo x', 'gh pr merge 5 | cat', 'cd /x && gh pr merge 5',
    'bash -c "gh pr merge 5"', "sh -c 'gh pr merge 5'", 'eval "gh pr merge 5"', 'eval gh pr merge 5',
    '(gh pr merge 5)', 'echo $(gh pr merge 5)', 'echo "$(gh pr merge 5)"', '`gh pr merge 5`', '{ gh pr merge 5; }',
    'G=gh; $G pr merge 5', 'echo "gh pr merge 5" | bash', 'bash <<< "gh pr merge 5"', "bash <<EOF\ngh pr merge 5\nEOF",
    'alias m="gh pr merge"; m 5', 'GH_REPO=o/r gh pr merge 5', 'GH_HOST=h gh pr merge 5', 'export GH_REPO=o/r; gh pr merge 5',
    '\\gh pr merge 5', 'gh \\\npr merge 5', 'gh -R o/r pr merge 5', 'gh pr merge', 'gh pr merge 5 6', 'gh pr merge 5 --bogus',
    'gh pr merge 5 -b "fixes 12"', 'gh pr merge 5 -F', 'gh pr merge 5 -R', 'gh pr merge 5 -R bad',
    "echo it's; gh pr merge 5", 'sudo gh pr merge 5', '/usr/bin/gh pr merge 5',
    'git commit -m "docs: gh pr merge is gated"', 'echo "gh pr merge 5"',
    'gh api -X PUT repos/o/r/pulls/42/merge', 'gh api graphql -f query=\'mutation { mergePullRequest(input:{}) { clientMutationId } }\'',
    'curl -X PUT https://api.github.com/repos/o/r/pulls/5/merge', 'gh pr merge 5 --auto && echo ok', 'GH pr merge 5', 'gh pr "mer"ge 5', 'gh pr mer\\ge 5', 'g\\h pr merge 5', "gh pr $'merge' 5", 'Gh Pr Merge 5',
    'gh pr merge 5 --auto', 'gh pr merge 5 --admin', 'gh pr merge --squash #12', 'gh pr merge ~/x', 'gh pr merge 5 -R o/r#x', 'gh pr merge -x', 'git merge x && gh pr view 5',
    'gh pr merge feature*', 'gh pr merge https://evil.example/o/r/pull/5', 'gh pr merge https://github.com/o/r/issues/5', 'gh pr merge a@b',
  ];
  for (const c of bad) {
    const r = classify(c);
    assert.equal(r.kind, 'blocked', c);
    assert.match(r.reason, /plain single form/, c);
  }
});

// --- check: receipt logic ---
const ok = { head_sha: 'abc1234', verdict: 'Ready to merge' };
const head = (sha) => () => sha;

test('check allows non-merge commands without any lookup', () => {
  const out = check('ls', { resolveHead: () => { throw new Error('must not resolve'); }, roots: [] });
  assert.equal(out.block, false);
});

test('check blocks a blocked form with the plain-form message and never resolves a head', () => {
  const out = check('cd x && gh pr merge 5', { resolveHead: () => { throw new Error('must not resolve'); }, roots: receipts({ r: ok }) });
  assert.equal(out.block, true);
  assert.match(out.reason, /plain single form/);
});

test('check blocks without a receipt, with a stale head, and with a missing or failing verdict', () => {
  assert.match(check('gh pr merge 166 --squash', { resolveHead: head('abc1234def'), roots: receipts({}) }).reason, /no passing \/ce-code-review receipt/);
  assert.equal(check('gh pr merge 166', { resolveHead: head('new1111'), roots: receipts({ r1: { head_sha: 'old0000', verdict: 'Ready to merge' } }) }).block, true);
  assert.equal(check('gh pr merge 166', { resolveHead: head('abc1234'), roots: receipts({ r1: { head_sha: 'abc1234' } }) }).block, true);
  assert.equal(check('gh pr merge 166', { resolveHead: head('abc1234'), roots: receipts({ r1: { head_sha: 'abc1234', verdict: 'Not ready' } }) }).block, true);
});

test('check allows on a matching head with an accepted verdict, among several and corrupt runs', () => {
  const roots = receipts({ a: 'not json{', b: { head_sha: 'zzz', verdict: 'Ready to merge' }, c: { head_sha: 'abc1234', verdict: 'Not ready' }, d: { head_sha: 'abc1234', verdict: 'Ready with fixes' } });
  assert.equal(check('gh pr merge 166 --squash', { resolveHead: head('abc1234'), roots }).block, false);
});

test('check fails closed when the head cannot be resolved', () => {
  const out = check('gh pr merge 166 -R o/r', { resolveHead: head(''), roots: receipts({ r: ok }) });
  assert.equal(out.block, true);
  assert.match(out.reason, /could not resolve the head commit of PR 166 in o\/r/);
});

test('hasReceipt tolerates a missing base dir and multiple roots', () => {
  assert.equal(hasReceipt('abc1234', [path.join(os.tmpdir(), 'nope-' + Date.now())]), null);
  assert.ok(hasReceipt('abc1234', [path.join(os.tmpdir(), 'nope2'), ...receipts({ r: ok })]));
  assert.deepEqual(receiptRoots({ CE_REVIEW_RECEIPT_DIRS: ['/a', '/b'].join(path.delimiter) }), ['/a', '/b']);
  assert.ok(receiptRoots({}).length >= 1);
});

// --- process-level contract with a fake gh ---
function fakeGh(body) {
  const dir = tmp('fakegh-');
  const log = path.join(dir, 'args.log');
  fs.writeFileSync(path.join(dir, 'gh'), `#!/bin/sh\necho "$@" >> "${log}"\n${body}\n`, { mode: 0o755 });
  return { dir, log };
}
function runHook(stdin, { pathDir, roots, extraEnv } = {}) {
  const env = { ...process.env, CE_REVIEW_RECEIPT_DIRS: (roots || receipts({})).join(path.delimiter), ...extraEnv };
  if (pathDir !== undefined) env.PATH = pathDir;
  return spawnSync(process.execPath, [HOOK], { input: stdin, encoding: 'utf8', env });
}
const bash = (command) => JSON.stringify({ tool_input: { command }, cwd: os.tmpdir() });
const withGh = (gh) => `${gh.dir}${path.delimiter}${process.env.PATH}`;

test('main exits 0 for non-merge commands and non-Bash payloads', () => {
  assert.equal(runHook(bash('ls -la')).status, 0);
  assert.equal(runHook(JSON.stringify({ tool_input: { file_path: 'gh merge' } })).status, 0);
});

test('main exits 2 without a receipt and 0 with one (CE_REVIEW_RECEIPT_DIRS honoured)', () => {
  const gh = fakeGh('echo abc1234');
  const none = runHook(bash('gh pr merge 9 --squash'), { pathDir: withGh(gh) });
  assert.equal(none.status, 2);
  assert.match(none.stderr, /PRE-MERGE REVIEW GATE/);
  assert.equal(runHook(bash('gh pr merge 9 --squash'), { pathDir: withGh(gh), roots: receipts({ r1: ok }) }).status, 0);
});

test('main exits 2 for chained, nested and prefixed merges even when a receipt exists', () => {
  const gh = fakeGh('echo abc1234');
  const roots = receipts({ r1: ok });
  for (const c of ['echo a && gh pr merge 9', 'bash -c "gh pr merge 9"', 'GH_REPO=o/r gh pr merge 9', 'cd /tmp && gh pr merge 9', 'curl -X PUT https://api.github.com/repos/o/r/pulls/9/merge']) {
    const r = runHook(bash(c), { pathDir: withGh(gh), roots });
    assert.equal(r.status, 2, c);
    assert.match(r.stderr, /plain single form/, c);
  }
  assert.ok(!fs.existsSync(gh.log), 'gh must not be called for blocked forms');
});

test('main passes URL, branch, number and -R/--repo straight to gh pr view', () => {
  const roots = receipts({ r1: ok });
  const cases = [
    ['gh pr merge https://github.com/o/r/pull/9 --squash', 'pr view https://github.com/o/r/pull/9 --json'],
    ['gh pr merge feature/x', 'pr view feature/x --json'],
    ['gh pr merge 5 --squash', 'pr view 5 --json'],
    ['gh pr merge 5 -R o/r', 'pr view 5 -R o/r --json'],
    ['gh pr merge 5 --repo o/r', 'pr view 5 -R o/r --json'],
  ];
  for (const [cmd, expected] of cases) {
    const gh = fakeGh('echo abc1234');
    const r = runHook(bash(cmd), { pathDir: withGh(gh), roots });
    assert.equal(r.status, 0, cmd + r.stderr);
    assert.ok(fs.readFileSync(gh.log, 'utf8').startsWith(expected), `${cmd} -> ${fs.readFileSync(gh.log, 'utf8')}`);
  }
});

test('main fails closed when gh is missing, errors, or hangs past the timeout', () => {
  assert.match(runHook(bash('gh pr merge 9'), { pathDir: '/nonexistent' }).stderr, /could not resolve/);
  assert.equal(runHook(bash('gh pr merge 9'), { pathDir: fakeGh('exit 1').dir }).status, 2);
  const hang = fakeGh('sleep 20; echo abc1234');
  const t0 = Date.now();
  const r = runHook(bash('gh pr merge 9'), { pathDir: withGh(hang), roots: receipts({ r1: ok }), extraEnv: { CE_GH_TIMEOUT_MS: '300' } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /could not resolve/);
  assert.ok(Date.now() - t0 < 10000);
});

test('prHead calls gh pr view with selector and -R and returns the trimmed head sha, or empty on failure', () => {
  const gh = fakeGh('echo " abc1234 "');
  const prev0 = process.env.PATH;
  process.env.PATH = gh.dir;
  try { assert.equal(prHead({ selector: '5', repo: 'o/r' }, os.tmpdir()), 'abc1234'); } finally { process.env.PATH = prev0; }
  assert.equal(fs.readFileSync(gh.log, 'utf8').trim(), 'pr view 5 -R o/r --json headRefOid -q .headRefOid');
  const prev = process.env.PATH;
  process.env.PATH = fakeGh('echo " abc1234 "').dir;
  try { assert.equal(prHead({ selector: '5', repo: '' }, os.tmpdir()), 'abc1234'); } finally { process.env.PATH = prev; }
  process.env.PATH = '/nonexistent';
  try { assert.equal(prHead({ selector: '5', repo: '' }, os.tmpdir()), ''); } finally { process.env.PATH = prev; }
});

test('main on malformed stdin blocks only when it mentions gh and merge', () => {
  assert.equal(runHook('gh pr merge 5 {not json').status, 2);
  assert.equal(runHook('').status, 0);
  assert.equal(runHook('garbage').status, 0);
});

test('settings.json gives the merge gate hook a timeout that outlives the gh timeout', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'settings.json'), 'utf8'));
  const entries = Object.values(cfg.hooks).flat().flatMap((g) => g.hooks).filter((h) => /pre-merge-review-gate\.js/.test(h.command));
  assert.equal(entries.length, 1);
  assert.ok(entries[0].timeout >= 25 && entries[0].timeout <= 60);
});

test('main blocks case-variant and quote-split merges and the --auto/--admin flags with specific messages', () => {
  const gh = fakeGh('echo abc1234');
  const roots = receipts({ r1: ok });
  const run = (c) => runHook(bash(c), { pathDir: withGh(gh), roots });
  assert.equal(run('GH pr merge 5').status, 2);
  assert.equal(run('gh pr "mer"ge 5').status, 2);
  assert.match(run('gh pr merge 5 --auto').stderr, /--auto is not allowed/);
  assert.match(run('gh pr merge 5 --admin').stderr, /--admin is not allowed/);
  assert.match(run('git merge x && gh pr view 5').stderr, /Split chained commands/);
  assert.match(run('gh pr merge --squash #12').stderr, /metacharacters/);
});

test('main exits 2 on an internal error only when the raw input mentions gh and merge (case-insensitive)', () => {
  // A directory as a receipt root override cannot crash; force a throw via a non-string cwd instead.
  const crash = (command) => runHook(JSON.stringify({ tool_input: { command }, cwd: { not: 'a string' } }), { pathDir: withGh(fakeGh('echo abc1234')), roots: receipts({ r1: ok }) });
  assert.equal(crash('GH pr merge 5').status, 2);
  assert.equal(crash('ls').status, 0);
});

test('looksLikeMerge is case-insensitive and needs both words', () => {
  const { looksLikeMerge } = require('../pre-merge-review-gate');
  assert.equal(looksLikeMerge('GH PR MERGE'), true);
  assert.equal(looksLikeMerge('gh pr view'), false);
  assert.equal(looksLikeMerge('git merge'), false);
});
