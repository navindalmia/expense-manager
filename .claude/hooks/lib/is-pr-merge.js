// Parses a shell command for a PR merge: `gh [global flags] pr merge [flags] [selector]`
// or `gh api .../pulls/<n>/merge`. Returns null when the command is not a PR merge, else
// { selector, repo, api }: selector is the positional PR number/URL/branch ('' = current
// branch), repo is the -R/--repo value ('' if none), api marks a `gh api` merge.
// Over-inclusive on purpose: a false positive only costs a receipt lookup, a false
// negative skips the gate.

// Flags whose next token is a value (never the selector).
const VALUE_FLAGS = new Set([
  '-b', '--body', '-t', '--subject', '-F', '--body-file', '-R', '--repo',
  '--match-head-commit', '-A', '--author-email', '-X', '--method', '-f', '--field',
  '-H', '--header', '--hostname', '--input', '-q', '--jq', '-t', '--template',
  '-F', '--raw-field', '--cache',
]);

// Split into command segments of unquoted tokens, breaking on ; & | ( ) { } backtick and
// newlines. Unquoted backslashes are dropped (so \gh and backslash-newline continuations
// resolve like the shell). Returns { segs, unbalanced } where unbalanced marks a quote that
// was never closed (the rest of the command was swallowed into one token).
function segments(command) {
  const out = [];
  let cur = [];
  let tok = '';
  let has = false;
  let q = '';
  const push = () => { if (has) cur.push(tok); tok = ''; has = false; };
  const end = () => { push(); if (cur.length) out.push(cur); cur = []; };
  const chars = Array.from(command);
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k];
    if (q) { if (ch === q) q = ''; else tok += ch; continue; }
    if (ch === '\\') { k += 1; if (k < chars.length && chars[k] !== '\n') { tok += chars[k]; has = true; } continue; }
    if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
    if (/\s/.test(ch) && ch !== '\n') { push(); continue; }
    if (';&|\n(){}`'.includes(ch)) { end(); continue; }
    tok += ch; has = true;
  }
  const unbalanced = q !== '';
  end();
  return { segs: out, unbalanced };
}

function flagValue(toks, i) {
  const t = toks[i];
  const eq = t.indexOf('=');
  if (t.startsWith('--') && eq > 0) return { name: t.slice(0, eq), value: t.slice(eq + 1), next: i + 1 };
  if (/^-R./.test(t)) return { name: '-R', value: t.slice(2), next: i + 1 };
  return { name: t, value: VALUE_FLAGS.has(t) ? (toks[i + 1] || '') : null, next: VALUE_FLAGS.has(t) ? i + 2 : i + 1 };
}

// Walk gh's global flags; return index of the first non-flag token (the subcommand) and -R.
function skipGlobals(toks, i, state) {
  while (i < toks.length && toks[i].startsWith('-')) {
    const f = flagValue(toks, i);
    if (f.name === '-R' || f.name === '--repo') state.repo = f.value || '';
    i = f.next;
  }
  return i;
}

function parseSegment(toks) {
  for (let g = 0; g < toks.length; g++) {
    if (toks[g].replace(/^.*\//, '') !== 'gh') continue;
    const state = { repo: '', env: {} };
    for (const t of toks.slice(0, g)) {
      const m = /^(GH_REPO|GH_HOST)=(.*)$/.exec(t);
      if (m) state.env[m[1]] = m[2];
    }
    if (state.env.GH_REPO) state.repo = state.env.GH_REPO;
    let i = skipGlobals(toks, g + 1, state);
    if (toks[i] === 'api') return parseApi(toks.slice(i + 1), state.repo, state.env);
    if (toks[i] !== 'pr') continue;
    i = skipGlobals(toks, i + 1, state);
    if (toks[i] !== 'merge') continue;
    let selector = '';
    for (i += 1; i < toks.length;) {
      if (toks[i].startsWith('-')) {
        const f = flagValue(toks, i);
        if (f.name === '-R' || f.name === '--repo') state.repo = f.value || '';
        i = f.next;
      } else { if (!selector) selector = toks[i]; i += 1; }
    }
    return { selector, repo: state.repo, api: false, env: state.env };
  }
  return null;
}

const GRAPHQL_MERGE = /mergePullRequest|enablePullRequestAutoMerge/;
const REST_MERGE = /\/pulls\/[^/\s]*\/merge\b/;

function parseApi(toks, repo, env) {
  for (const t of toks) {
    const m = /(?:^|\/)repos\/([^/\s]+\/[^/\s]+)\/pulls\/(\d+)\/merge\b/.exec(t);
    if (m) return { selector: m[2], repo: repo || m[1], api: true, env };
    if (REST_MERGE.test(t)) return { selector: '', repo, api: true, env };
    if (GRAPHQL_MERGE.test(t)) return { unsupported: 'gh api graphql PR merge mutations cannot be matched to a receipt; use `gh pr merge <n>` after /ce-code-review' };
  }
  return null;
}

// curl/wget to the REST merge endpoint, or any token carrying a GraphQL merge mutation.
function parseOther(toks) {
  const head = toks[0] && toks[0].replace(/^.*\//, '');
  if ((head === 'curl' || head === 'wget') && toks.some((t) => REST_MERGE.test(t) || GRAPHQL_MERGE.test(t))) {
    return { unsupported: 'curl/wget PR merge cannot be matched to a receipt; use `gh pr merge <n>` after /ce-code-review' };
  }
  return null;
}

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);

// Nested command strings: `bash -c "<cmd>"`, `eval <cmd...>`.
function nestedCommands(toks) {
  const base = toks.map((t) => t.replace(/^.*\//, ''));
  const out = [];
  for (let k = 0; k < toks.length; k++) {
    if (SHELLS.has(base[k])) {
      for (let j = k + 1; j < toks.length; j++) {
        if (/^-[a-z]*c[a-z]*$/.test(toks[j]) && toks[j + 1] !== undefined) { out.push(toks[j + 1]); break; }
      }
    }
    if (base[k] === 'eval') out.push(toks.slice(k + 1).join(' '));
  }
  return out;
}

const RAW_MERGE = /\bgh\b[\s\S]*\bpr\b[\s\S]*\bmerge\b|mergePullRequest|enablePullRequestAutoMerge|\/pulls\/[^/\s]*\/merge\b/;
const PIVOT = /^(cd|pushd)$/;

function scan(command, depth) {
  const { segs, unbalanced } = segments(command);
  let pivot = false;
  for (const seg of segs) {
    const r = parseSegment(seg) || parseOther(seg);
    if (r) return { r, pivot };
    if (depth < 3) {
      for (const inner of nestedCommands(seg)) {
        const nested = scan(inner, depth + 1);
        if (nested) return { r: nested.r, pivot: pivot || nested.pivot };
      }
    }
    const first = seg[0] && seg[0].replace(/^.*\//, '');
    if (PIVOT.test(first) || (first === 'export' && seg.some((t) => /^GH_(REPO|HOST)=/.test(t)))) pivot = true;
  }
  if (unbalanced && RAW_MERGE.test(command)) {
    return { r: { unsupported: 'unbalanced quote in a command that mentions a PR merge; cannot parse it safely' }, pivot };
  }
  return null;
}

// Result: null (not a merge), or { selector, repo, api, env } or { unsupported: <reason> }.
function parsePrMerge(command) {
  if (typeof command !== 'string') return null;
  const hit = scan(command, 0);
  if (!hit) return null;
  const { r, pivot } = hit;
  if (r.unsupported) return r;
  const hasUrl = /^https?:\/\//.test(r.selector);
  if (pivot && !r.repo && !hasUrl) {
    return { unsupported: 'cd/pushd or an exported GH_REPO/GH_HOST precedes the merge, so the PR cannot be resolved reliably; pass -R <owner/repo> or the PR URL' };
  }
  return r;
}

module.exports = { parsePrMerge };
