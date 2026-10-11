#!/usr/bin/env node
// Decides whether a pull request may target master.
//   node scripts/promotion-source.js <base-ref> <head-ref> [labels-json-array] [head-repo] [this-repo]
// Rule: a PR into master must come from `staging`, unless it carries the
// `hotfix` label. The head must live in THIS repository (a fork can name a
// branch `staging`). PRs into any other base are not this check's concern.
// Exit 0 = allowed, 1 = blocked. Inputs arrive via argv (callers pass them
// through env vars, never interpolated into a shell string).
'use strict';

const PROTECTED_BASE = 'master';
const PROMOTION_HEAD = 'staging';
const HOTFIX_LABEL = 'hotfix';

function evaluatePromotion(baseRef, headRef, labels = [], headRepo = '', thisRepo = '') {
  if (baseRef !== PROTECTED_BASE) {
    return { ok: true, reason: `base is ${baseRef || '(none)'}, not ${PROTECTED_BASE}; not applicable` };
  }
  if (!headRepo || !thisRepo || headRepo !== thisRepo) {
    return { ok: false, reason: `head repository '${headRepo || '(unknown)'}' is not '${thisRepo || '(unknown)'}'; PRs from forks may not target ${PROTECTED_BASE}.` };
  }
  if (headRef === PROMOTION_HEAD) {
    return { ok: true, reason: `promotion from ${PROMOTION_HEAD}` };
  }
  if (labels.includes(HOTFIX_LABEL)) {
    return { ok: true, reason: `'${HOTFIX_LABEL}' label present (owner-applied exception)` };
  }
  return {
    ok: false,
    reason: `PRs into ${PROTECTED_BASE} must come from '${PROMOTION_HEAD}' (head is '${headRef}'). Retarget to ${PROMOTION_HEAD}, or the owner may add the '${HOTFIX_LABEL}' label for a true hotfix.`,
  };
}

function parseLabels(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((l) => typeof l === 'string') : [];
  } catch {
    return [];
  }
}

if (require.main === module) {
  const [base, head, labels, headRepo, thisRepo] = process.argv.slice(2);
  const result = evaluatePromotion(base, head, parseLabels(labels), headRepo, thisRepo);
  process.stdout.write(`${result.ok ? 'OK' : 'BLOCKED'}: ${result.reason}\n`);
  process.exit(result.ok ? 0 : 1);
}

module.exports = { evaluatePromotion, parseLabels };
