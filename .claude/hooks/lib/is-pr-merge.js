// Allowlist classifier for PR-merge commands (no shell parsing).
//
// Rule: a command whose RAW text contains both the word `gh` and the word `merge`, or that
// touches a PR-merge API route (/pulls/<n>/merge, mergePullRequest, enablePullRequestAutoMerge),
// is allowed through to the receipt check ONLY when it is exactly one simple command:
//     gh pr merge <number|url|branch> [known flags] [-R|--repo owner/repo]
// Anything else is blocked, so chained, nested, indirect or obfuscated merges block by
// construction. A commit message that merely mentions `gh ... merge` is blocked too; write the
// message with `git commit -F <file>` instead.
//
// classify(command) -> { kind: 'none' } | { kind: 'simple', selector, repo } | { kind: 'blocked', reason }

const TRIGGER = [/\bgh\b[\s\S]*\bmerge\b|\bmerge\b[\s\S]*\bgh\b/, /\/pulls\/[^/\s]*\/merge\b/, /mergePullRequest|enablePullRequestAutoMerge/];

const SAFE_ARG = /^[A-Za-z0-9._/:#@%+=~-]+$/;
const BOOL_FLAGS = new Set(['-s', '--squash', '-m', '--merge', '-r', '--rebase', '--auto', '--admin', '-d', '--delete-branch', '--disable-auto']);
const VALUE_FLAGS = new Set(['-R', '--repo', '-F', '--body-file', '--match-head-commit']);

const HELP = 'Run the plain single form `gh pr merge <number|url|branch> [--squash|--merge|--rebase] [--auto] [--admin] [-d] [-R owner/repo] [-F bodyfile]` with no chaining, pipes, quotes, subshells, eval/bash -c, env or cd prefixes. For commit/PR text that only mentions gh and merge, write it to a file and use -F.';

function blocked(why) {
  return { kind: 'blocked', reason: `${why}. ${HELP}` };
}

function parseSimple(command) {
  const text = command.trim();
  if (!/^[A-Za-z0-9._/:#@%+=~ \t-]+$/.test(text)) return blocked('this command mentions a PR merge but is not a single plain command (shell metacharacters, quotes or line breaks present)');
  const t = text.split(/\s+/);
  if (t[0] !== 'gh' || t[1] !== 'pr' || t[2] !== 'merge') return blocked('this command mentions gh and merge but is not `gh pr merge ...`');
  let selector = '';
  let repo = '';
  for (let i = 3; i < t.length; i += 1) {
    const a = t[i];
    if (BOOL_FLAGS.has(a)) continue;
    const eq = /^(--repo|--body-file|--match-head-commit)=(.+)$/.exec(a);
    if (eq) { if (eq[1] === '--repo') repo = eq[2]; continue; }
    if (VALUE_FLAGS.has(a)) {
      const v = t[i + 1];
      if (!v || v.startsWith('-') || !SAFE_ARG.test(v)) return blocked(`flag ${a} needs a plain value`);
      if (a === '-R' || a === '--repo') repo = v;
      i += 1;
      continue;
    }
    if (a.startsWith('-')) return blocked(`unsupported flag ${a}`);
    if (selector) return blocked('more than one PR selector');
    selector = a;
  }
  if (!selector) return blocked('a PR number, URL or branch name is required');
  if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) return blocked('malformed -R/--repo value');
  return { kind: 'simple', selector, repo };
}

function classify(command) {
  if (typeof command !== 'string' || !TRIGGER.some((re) => re.test(command))) return { kind: 'none' };
  return parseSimple(command);
}

module.exports = { classify };
