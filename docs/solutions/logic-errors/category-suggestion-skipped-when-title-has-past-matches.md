---
title: Category auto-match never fired for titles that already had past matches (e.g. "dinner")
date: 2026-10-04
category: docs/solutions/logic-errors
module: expenses
problem_type: logic_error
component: service_object
symptoms:
  - "Typing 'dinner' in a new expense does not set the Category to Food when the user already has an expense titled 'Dinner'"
  - "Typing 'Dinner out' (no past match) does set Food, so the feature looks randomly inconsistent"
  - "'pizza', 'supper' and the plural 'dinners' never suggest a category"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [category-suggestion, autocomplete, keyword-dictionary, expenses, history-based-suggestion]
---

# Category auto-match never fired for titles that already had past matches (e.g. "dinner")

## Problem

The keyword dictionary maps `dinner` to FOOD (`backend/src/lib/categoryKeywordDictionary.ts:12`), but a user typing "dinner" did not get Food selected. The suggestion was gated on the *absence* of title matches in two places, so it silently disappeared for exactly the titles the user types most often.

## Symptoms

Reproduced against a running backend with an account that had an earlier "Dinner" expense:

| Title | Past matches | categorySuggestion |
|---|---|---|
| `dinner` | 2 | none |
| `Dinner out` | 0 | FOOD |
| `pizza`, `supper` | 0 | none (words not in the dictionary) |
| `dinners` | 1 | none (plural not matched) |

## What Didn't Work

Nothing was tried that failed; the cause was visible by reading both call sites once the live probe showed the pattern. (Checking only the dictionary would have wrongly suggested the data was fine, since `dinner` is present.)

## Solution

Status: **implemented and verified locally; not yet pushed or merged as of 2026-10-04** (an unpushed local commit on top of PR #90's branch; unit tests 543 backend / 251 frontend passing, plus a live probe).

- Backend (`backend/src/controllers/expenseController.ts:98` gated the call on `matches.length === 0`): always compute the suggestion for a non-empty title. First choice is the category the user used most often among the matched past expenses, restricted to categories they can currently select; otherwise fall back to the keyword dictionary. The response keeps its shape and gains an optional `source: 'history' | 'keyword'`.
- Dictionary: match simple plurals (trailing `s`/`es` ignored on both sides, only for longer words, so `gasket` still never matches `gas` and multi-word keywords like `gas bill` still work) and add everyday words per category (pizza, burger, supper, snack, wifi, metro and similar). A test fails if one keyword appears under two categories.
- Frontend (`frontend/src/screens/EditExpenseScreen.tsx:136` applied the suggestion only when `result.matches.length === 0`): apply whenever a suggestion arrives, unless the user has already picked a category in this form session.

Live probe after the change: `dinner` and `dinners` return FOOD with `source: history`; `pizza`, `supper` and `Dinner out` return FOOD with `source: keyword`; `gasket repair` correctly returns nothing.

## Why This Works

History is the strongest signal for what a given user means by a title, and the dictionary is a generic fallback. Treating them as alternatives gated on each other's emptiness made the better signal suppress the worse one's output instead of replacing it.

## Prevention

- When a feature has two sources of a suggestion, order them by priority and fall through; do not make one source's presence a precondition for the other.
- Test with realistic data that includes prior history, not an empty account. The earlier tests only covered the empty-history path.
- Known simplification: "most used" is counted over the distinct matching titles returned by the autocomplete lookup (one per title), not over every historical expense, and ties go to the best-ranked match because matches carry no date.

## Related Issues

- `docs/solutions/logic-errors/dictionary-keyword-iteration-order-shadows-multiword-match.md` (earlier bug in the same dictionary)
- `docs/solutions/logic-errors/group-soft-delete-leaves-expense-titles-in-autocomplete-pool.md` (the autocomplete pool this history is read from)
