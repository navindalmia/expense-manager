// Returns the PR selector of a `gh pr merge ...` command (a number string, or '' for
// "current branch"), or null when the command is not a PR merge. Over-inclusive on
// purpose: a false positive only costs a receipt lookup, a false negative skips the gate.
const GH_PR_MERGE = /(^|[^\w-])gh\s+pr\s+merge\b([^;&|\n]*)/;

function parsePrMerge(command) {
  if (typeof command !== 'string') return null;
  const m = GH_PR_MERGE.exec(command);
  if (!m) return null;
  const sel = /(?:^|\s)(\d+)(?=\s|$)/.exec(m[2]);
  return sel ? sel[1] : '';
}

module.exports = { parsePrMerge };
