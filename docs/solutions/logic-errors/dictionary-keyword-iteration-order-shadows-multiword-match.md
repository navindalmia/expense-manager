---
title: "Object key iteration order let a single-word dictionary keyword shadow a more specific multi-word one"
date: 2026-09-14
category: logic-errors
module: backend/src/lib/categoryKeywordDictionary.ts
problem_type: logic_error
component: backend
symptoms:
  - "suggestCategoryCode('Gas bill for March') returned TRAVEL instead of the expected UTILITIES"
  - "The dictionary's UTILITIES entry for \"gas bill\" could never fire for any title that also contained the standalone word \"gas\""
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [keyword-matching, iteration-order, category-suggestion, whole-word-matching]
---

# Object key iteration order let a single-word dictionary keyword shadow a more specific multi-word one

## Problem

`categoryKeywordDictionary.ts`'s `suggestCategoryCode` iterated `CATEGORY_KEYWORD_DICTIONARY`'s categories in declaration order and returned on the first matching keyword. `TRAVEL` (declared before `UTILITIES`) includes the single-word keyword `"gas"`; `UTILITIES` includes the multi-word keyword `"gas bill"`. Any title containing "gas" matched `TRAVEL` before the loop ever reached `UTILITIES`'s more specific `"gas bill"` entry.

## Symptoms

- `suggestCategoryCode('Gas bill for March')` returned `'TRAVEL'`, not `'UTILITIES'`.
- The bug was silent — no error, no test failure until a test was specifically written to check the multi-word case, because the single-word-only test cases (e.g. `"gas station"` → `TRAVEL`) all passed correctly on their own.

## What Didn't Work

Nothing was attempted and discarded — this was caught by an independent code-review pass (not live debugging), which made the fix straightforward once the root cause was identified: match ordering, not match logic itself, was wrong.

## Solution

Split the matching loop into two passes: check every multi-word keyword across *all* categories first, and only fall back to single-word keywords if no multi-word keyword matched.

```ts
// Multi-word keywords (e.g. "gas bill") are checked across every category
// before any single-word keyword (e.g. "gas") -- otherwise a shorter,
// single-word keyword from an earlier-declared category would always win
// and the more specific multi-word entry could never fire.
for (const [categoryCode, keywords] of Object.entries(CATEGORY_KEYWORD_DICTIONARY)) {
  for (const keyword of keywords) {
    if (keyword.includes(' ') && containsWholeWordPhrase(titleTokens, keyword)) {
      return categoryCode;
    }
  }
}

for (const [categoryCode, keywords] of Object.entries(CATEGORY_KEYWORD_DICTIONARY)) {
  for (const keyword of keywords) {
    if (!keyword.includes(' ') && titleTokenSet.has(keyword)) {
      return categoryCode;
    }
  }
}
```

A follow-up review pass also found the multi-word branch itself was doing a raw substring check (`normalizedTitle.includes(keyword)`), which let `"gas bill"` match inside unrelated text like `"gas billboard"`. Fixed by matching multi-word keywords as a contiguous run of whole-word tokens (`containsWholeWordPhrase`), the same word-boundary guarantee single-word keywords already had.

## Why This Works

`Object.entries()` on a plain object always iterates in declaration order (for string keys). A dictionary is naturally declared with unrelated categories side by side, so nothing about the data structure itself encodes "prefer more specific keywords" — that has to be an explicit rule in the matching logic, not an accident of which category was typed first in the source file.

## Prevention

- Any keyword-matching dictionary where entries can vary in specificity (single word vs. phrase) needs an explicit precedence rule in the match function — never rely on object/array declaration order to imply priority.
- Regression tests added for both bugs: `"Gas bill for March"` → `UTILITIES` (precedence), and `"Call Billy, phone Billy about the trip"` → no match (word-boundary; a raw substring check would have wrongly matched `"phone bill"` inside `"phone Billy"`).

## Related Issues

- `backend/src/lib/__tests__/categoryKeywordDictionary.test.ts` — regression tests for both bugs.
- Fixed as part of the intelligence-layer plan, opened as PR #55 (unmerged as of this writing) — see that PR's commit history for the precedence fix and its same-commit word-boundary follow-up.
