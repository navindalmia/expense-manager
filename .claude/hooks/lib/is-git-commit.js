// True when a Bash command line runs `git commit` anywhere in it, including
// compound commands (`cd x && git add -A && git commit -m y`), global options
// of any shape before the subcommand (`git -C "/a b" commit`, `--git-dir x`,
// `-p`), an absolute path to git, subshells and `bash -c "..."` wrappers.
// Deliberately over-inclusive: a false positive (e.g. `echo "git commit"`)
// only costs the gate scripts a quick re-check, a false negative silently
// skips the gate. `git commit-tree` and `--grep=commit` are still excluded:
// `commit` must be a whole word preceded by whitespace.

const GIT_COMMIT = /(^|[^\w-])git\b[^;&|\n]*\scommit(\s|$)/;

function isGitCommit(command) {
  return typeof command === 'string' && GIT_COMMIT.test(command);
}

module.exports = { isGitCommit };
