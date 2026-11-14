// Allowlist classifier for PR-merge commands (no shell parsing).
//
// Trigger: a command is "merge-related" when a NORMALIZED copy of it (lower-cased, with quotes,
// backticks, backslashes, `$'..'` and line continuations removed) contains both the word `gh`
// and the word `merge`, or touches a PR-merge API route (/pulls/<n>/merge, mergePullRequest,
// enablePullRequestAutoMerge). So `GH pr merge 5` and `gh pr "mer"ge 5` fire the gate.
//
// Allowed: a merge-related command passes to the receipt check ONLY when the ORIGINAL text is
// exactly one plain command:
//     gh pr merge <number|github.com PR URL|branch> [-s|-m|-r|-d|--disable-auto] [-R|--repo owner/repo]
//                                                   [-F|--body-file file] [--match-head-commit sha]
// with no shell metacharacters (; & | < > ( ) { } $ ` \ " ' # ~ * ? newline) anywhere.
// `--auto` and `--admin` are blocked: GitHub merges later, at a head the receipt never covered.
// Run the plain merge once CI is green.
//
// Known, deliberate false block: `git merge x && gh pr view 5`, or a commit message that merely
// mentions gh and merge, is blocked too because the trigger is word-based on the whole command.
// Split chained commands into separate Bash calls and write commit/PR text with `-F <file>`.
//
// Out of scope (see CLAUDE.md "Pre-merge review gate"): merges by other tools, the GitHub UI,
// aliases or variable-built command names that never spell the word `merge`.
//
// classify(command) -> { kind: 'none' } | { kind: 'simple', selector, repo } | { kind: 'blocked', reason }

const TRIGGER = [/\bgh\b[\s\S]*\bmerge\b|\bmerge\b[\s\S]*\bgh\b/, /\/pulls\/[^/\s]*\/merge\b/, /mergepullrequest|enablepullrequestautomerge/];

const PLAIN_TEXT = /^[A-Za-z0-9._/: =-]+$/;
const BOOL_FLAGS = new Set(['-s', '--squash', '-m', '--merge', '-r', '--rebase', '-d', '--delete-branch', '--disable-auto']);
const VALUE_FLAGS = new Set(['-R', '--repo', '-F', '--body-file', '--match-head-commit']);
const REFUSED_FLAGS = new Set(['--auto', '--admin']);
const NUMBER = /^\d+$/;
const PR_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/;
const BRANCH = /^[A-Za-z0-9._/-]+$/;

const HELP = 'Run the plain single form `gh pr merge <number|PR URL|branch> [--squash|--merge|--rebase] [-d] [-R owner/repo] [-F bodyfile]` as its own Bash call: no chaining, pipes, quotes, subshells, eval/bash -c, env or cd prefixes. Split chained commands into separate calls; for commit/PR text that only mentions gh and merge, write it to a file and use -F.';

function blocked(why) {
  return { kind: 'blocked', reason: `${why}. ${HELP}` };
}

function normalize(command) {
  return command.replace(/\\\r?\n/g, '').replace(/\$'/g, '').replace(/[\\'"`]/g, '').toLowerCase();
}

function validSelector(s) {
  return NUMBER.test(s) || PR_URL.test(s) || (BRANCH.test(s) && !s.startsWith('-'));
}

function parseSimple(command) {
  const text = command.trim();
  if (!PLAIN_TEXT.test(text)) return blocked('this command mentions a PR merge but is not a single plain command (it contains shell metacharacters such as ; & | $ ( ) quotes, # ~ or line breaks, or uses a different case for gh)');
  const t = text.split(/\s+/);
  if (t[0] !== 'gh' || t[1] !== 'pr' || t[2] !== 'merge') return blocked('this command mentions gh and merge but is not `gh pr merge ...` (for example `git merge x && gh pr view 5` is blocked because it also mentions both words)');
  let selector = '';
  let repo = '';
  for (let i = 3; i < t.length; i += 1) {
    const a = t[i];
    if (REFUSED_FLAGS.has(a)) return blocked(`${a} is not allowed: it merges later at a head the review receipt never covered; wait for CI to be green and run the plain merge`);
    if (BOOL_FLAGS.has(a)) continue;
    const eq = /^(--repo|--body-file|--match-head-commit)=(.+)$/.exec(a);
    if (eq) { if (eq[1] === '--repo') repo = eq[2]; continue; }
    if (VALUE_FLAGS.has(a)) {
      const v = t[i + 1];
      if (!v || v.startsWith('-')) return blocked(`flag ${a} needs a plain value`);
      if (a === '-R' || a === '--repo') repo = v;
      i += 1;
      continue;
    }
    if (a.startsWith('-')) return blocked(`unsupported flag ${a}`);
    if (selector) return blocked('more than one PR selector');
    selector = a;
  }
  if (!selector) return blocked('a PR number, URL or branch name is required');
  if (!validSelector(selector)) return blocked('the PR selector must be digits, a https://github.com/<owner>/<repo>/pull/<n> URL, or a branch name of letters, digits, . _ / -');
  if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) return blocked('malformed -R/--repo value');
  return { kind: 'simple', selector, repo };
}

function classify(command) {
  if (typeof command !== 'string') return { kind: 'none' };
  const n = normalize(command);
  if (!TRIGGER.some((re) => re.test(n))) return { kind: 'none' };
  return parseSimple(command);
}

module.exports = { classify };
