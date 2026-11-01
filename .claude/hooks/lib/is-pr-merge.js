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

// Split into command segments of unquoted tokens, breaking on ; & | and newlines.
function segments(command) {
  const out = [];
  let cur = [];
  let tok = '';
  let has = false;
  let q = '';
  const push = () => { if (has) cur.push(tok); tok = ''; has = false; };
  const end = () => { push(); if (cur.length) out.push(cur); cur = []; };
  for (const ch of command) {
    if (q) { if (ch === q) q = ''; else tok += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
    if (/\s/.test(ch) && ch !== '\n') { push(); continue; }
    if (ch === ';' || ch === '&' || ch === '|' || ch === '\n') { end(); continue; }
    tok += ch; has = true;
  }
  end();
  return out;
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
    const state = { repo: '' };
    let i = skipGlobals(toks, g + 1, state);
    if (toks[i] === 'api') return parseApi(toks.slice(i + 1), state.repo);
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
    return { selector, repo: state.repo, api: false };
  }
  return null;
}

function parseApi(toks, repo) {
  for (const t of toks) {
    const m = /(?:^|\/)repos\/([^/\s]+\/[^/\s]+)\/pulls\/(\d+)\/merge\b/.exec(t);
    if (m) return { selector: m[2], repo: repo || m[1], api: true };
    if (/\/pulls\/[^/]*\/merge\b/.test(t)) return { selector: '', repo, api: true };
  }
  return null;
}

function parsePrMerge(command) {
  if (typeof command !== 'string') return null;
  for (const seg of segments(command)) {
    const r = parseSegment(seg);
    if (r) return r;
  }
  return null;
}

module.exports = { parsePrMerge };
