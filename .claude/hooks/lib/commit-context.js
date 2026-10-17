// Shared command parsing for the pre-commit gates.
//
// - splitSegments: split a Bash command on unquoted `;` `&` `&&` `|` `||` and
//   newlines, skipping heredoc bodies (so text inside `<<EOF ... EOF` is never
//   mistaken for a command).
// - The target repo honours leading `cd <path>` / `pushd <path>` segments (also
//   inside `( ... )` / `{ ... }`) and `git -C <path>` placed between `git` and
//   `commit`, falling back to the hook cwd.
// - The commit message is parsed only from the segment that runs `git ... commit`.
//
// Known residual gaps: Windows backslash paths, `-F`/`-F -` messages, and
// `git add` in the same command as the commit.

const path = require('path');
const { isGitCommit } = require('./is-git-commit');

function splitSegments(command) {
  const segments = [];
  let current = '';
  let quote = null;
  let pendingHeredoc = null;
  const push = () => {
    if (current.trim()) segments.push(current.trim());
    current = '';
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (quote === '"' && ch === '\\' && i + 1 < command.length) current += command[++i];
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === '<' && command[i + 1] === '<' && command[i + 2] !== '<') {
      const m = command.slice(i).match(/^<<-?\s*(?:"([^"]+)"|'([^']+)'|(\w+))/);
      if (m) pendingHeredoc = m[1] || m[2] || m[3];
      current += ch;
    } else if (ch === '\n') {
      push();
      if (pendingHeredoc) {
        const lines = command.slice(i + 1).split('\n');
        let consumed = 0;
        for (const line of lines) {
          consumed += line.length + 1;
          if (line.trim() === pendingHeredoc) break;
        }
        i += consumed;
        pendingHeredoc = null;
      }
    } else if (ch === ';' || ch === '&' || ch === '|') {
      push();
      if ((ch === '&' || ch === '|') && command[i + 1] === ch) i++;
    } else {
      current += ch;
    }
  }
  push();
  return segments;
}

function unquote(word) {
  if (word.length >= 2 && (word[0] === '"' || word[0] === "'") && word[word.length - 1] === word[0]) {
    return word.slice(1, -1);
  }
  return word;
}

const QUOTED_OR_WORD = '(?:"[^"]*"|\'[^\']*\'|\\S+)';
// Anything that may precede `git`: subshell/brace openers, sudo/env wrappers, env assignments.
const PREFIX =
  '^[\\s({]*(?:(?:sudo|env)(?:\\s+-\\S+)*\\s+|\\w+=(?:"[^"]*"|\'[^\']*\'|\\S*)\\s+)*(?:\\S*\\/)?';
// git <global options> commit; group 1 = the global options between git and commit.
const GIT_COMMIT_SEGMENT = new RegExp(
  PREFIX +
    'git((?:\\s+(?:-[Cc]\\s+' + QUOTED_OR_WORD + '|--[\\w-]+(?:=' + QUOTED_OR_WORD + ')?|-\\w))*)\\s+commit(?:\\s|$)'
);
const SHELL_WRAPPED = new RegExp(PREFIX + '(?:ba|z)?sh\\s+-c\\s');

// The segment must actually START with git (or a bash/sh -c wrapper), so an
// echoed `git commit -m ...` is not mistaken for the commit.
function findCommitSegmentIndex(segments) {
  return segments.findIndex(
    (s) => (GIT_COMMIT_SEGMENT.test(s) || SHELL_WRAPPED.test(s)) && isGitCommit(s)
  );
}

// Directory after applying leading cd/pushd segments (relative paths resolve against base).
function applyCds(segments, base) {
  let dir = base;
  for (const seg of segments) {
    const m = seg.match(/^[\s({]*(?:cd|pushd)\s+(?:-\S+\s+)?("[^"]+"|'[^']+'|[^\s)}]+)\s*[)}]*$/);
    if (m) dir = path.resolve(dir, unquote(m[1]));
  }
  return dir;
}

function resolveTargetDir(hookInput) {
  const command = hookInput && hookInput.tool_input && hookInput.tool_input.command;
  const base = (hookInput && hookInput.cwd) || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (typeof command !== 'string') return base;
  const segments = splitSegments(command);
  let idx = findCommitSegmentIndex(segments);
  if (idx === -1) idx = segments.length;
  let target = applyCds(segments.slice(0, idx), base);
  const gitMatch = segments[idx] && segments[idx].match(GIT_COMMIT_SEGMENT);
  if (gitMatch) {
    const re = new RegExp('-C\\s+(' + QUOTED_OR_WORD + ')', 'g');
    let m;
    while ((m = re.exec(gitMatch[1])) !== null) target = path.resolve(target, unquote(m[1]));
  }
  return target;
}

// `$(cat <<'EOF' ... EOF)` -> the heredoc body; anything else unchanged.
function unwrapHeredoc(text) {
  const m = text.match(/^\$\(\s*cat\s*<<-?\s*(["']?)(\w+)\1\s*\n([\s\S]*?)\n[ \t]*\2[ \t]*\n?\s*\)$/);
  return m ? m[3] : text;
}

// -m / --message flags of the `git commit` segment only; null when none found.
function extractCommitMessage(command) {
  if (typeof command !== 'string') return null;
  const segments = splitSegments(command);
  const idx = findCommitSegmentIndex(segments);
  if (idx === -1) return null;
  const messages = [];
  const re = /(?:^|\s)(?:-[A-Za-z]*m\s*|--message(?:=|\s+))("((?:[^"\\]|\\.)*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(segments[idx])) !== null) {
    messages.push(unwrapHeredoc(match[2] !== undefined ? match[2] : match[3]));
  }
  return messages.length === 0 ? null : messages.join('\n\n');
}

module.exports = { splitSegments, resolveTargetDir, extractCommitMessage };
