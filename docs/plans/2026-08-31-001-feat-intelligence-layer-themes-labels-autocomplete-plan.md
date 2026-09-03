---
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
---

# Intelligence Layer: Themes, Labels, Category Auto-Suggestion & Expense Autocomplete - Plan

## Goal Capsule

**Objective:** Lay the foundational "intelligence layer" infrastructure (recurring group linkage via Themes, free-text cross-group Labels, extensible Categories, and expense-entry autocomplete/auto-suggestion) that later user-facing features — a settlement/KPI dashboard, natural-language expense Q&A (Phase 8), scheduled recurring-expense generation — will build on. This plan intentionally ships infra before UI: it exists because the user's actual monthly workflow (a new `Group` per month, no linkage between them, full manual re-entry of recurring expenses) has no structural support today, and building the flashier consumer-facing views first would mean rebuilding them once the underlying data model changes.

**Product authority:** Solo-developer personal project (Navin), not a multi-stakeholder product decision. Requirements below are the distilled result of an extended `/ce-brainstorm` dialogue that explored and explicitly rejected several larger/adjacent directions (see Out of Scope).

**Open blockers:** None — dialogue reached full convergence, all decision points below are session-settled.

---

## Product Contract

### Requirements

- **R1 — Theme (Group-level, reusable).** `Group` gains a new, optional, editable field: `theme`. When creating or editing a group, the user picks an existing theme or creates a new one via the same dropdown (see R7 for the shared dropdown UX). A theme is shared master data — editing its name updates it everywhere it's referenced; disabling it (not hard-deleting) removes it from the create/edit dropdown for new selections while groups that already reference it keep working normally. Themes exist to link groups across time (e.g. "Monthly Expense" reused every month) as the foundation for future cross-group aggregation — no aggregation UI is built in this plan (see Out of Scope).

- **R2 — Category becomes user-extensible.** The existing fixed 7-category set (`FOOD`, `ACCOMMODATION`, `TRAVEL`, `ENTERTAINMENT`, `SHOPPING`, `UTILITIES`, `OTHER`) remains as seeded defaults, but users can now add their own custom categories via the same "Add new" dropdown pattern as R7. Custom categories are disabled rather than hard-deleted when removed, for the same reason as R1.

- **R3 — Label (new entity, free-text, cross-group, shared master data).** A new `Label` concept, distinct from both Category and Theme: a free-text, user-created tag (e.g. "Liverpool") applicable to individual expenses, reusable across any group (not scoped to a single group or theme). Like Theme and Category, a Label is shared master data (id + editable name) — editing the name propagates everywhere; the same "disable, don't hard-delete" behavior applies (R6).

- **R4 — Manage Labels screen.** A standalone screen, reachable outside any specific group (e.g. from a top-level settings/menu area), listing all labels the user has created. For each label, show the total amount spent across all expenses currently carrying that label (a simple cross-group sum — not the deferred multi-chart dashboard). This screen is also where a user disables a label (R6).

- **R5 — Expense-title autocomplete.** As the user types an expense title on the create/edit-expense screen, the app fuzzy-matches against the user's own past expenses **globally** (across all groups, not scoped to the current group's theme). Presenting a match and the user selecting it prefills: members (split-with list), amount, and category from that past expense. The expense date always defaults to today regardless of the matched expense's date. Every prefilled field remains editable before the user saves — nothing is auto-submitted.

- **R6 — Shared "disable, don't hard-delete" behavior for Theme, Category, and Label.** All three master-data types use the same lifecycle rule: disabling removes the item from create/edit dropdowns for new selections, but any expense or group that already references it keeps that reference and displays it normally. This preserves historical data integrity across all three without needing per-type reference-counting/deletion-blocking logic.

- **R7 — Shared dropdown UX for Theme, Category, and Label selection.** All three selectors (on the create/edit-group screen for Theme, on the create/edit-expense screen for Category and Label) share one interaction pattern: the first option in the dropdown is always "Add new," followed by the user's existing saved values for that type; the dropdown supports type-ahead filtering (narrowing the existing-values list as the user types), the same interaction shape as R5's title autocomplete.

- **R8 — Category auto-suggestion for expense titles with no close match.** When R5's title-autocomplete finds no close match (a genuinely new title), the app attempts a category auto-suggestion via **keyword-dictionary matching** — a maintained mapping of common words (e.g. "fuel," "gas," "petrol" → Transport-equivalent category) to the category set from R2. If no keyword matches, category defaults to "Other" (or the user's last-used category — implementation detail for planning to resolve). Every suggestion made, and whether the user accepted or overrode it, is logged (new field/table — implementation detail for planning) to build a labeled dataset for a possible future graduation to a smarter mechanism (explicitly not ML/LLM-based in this plan — see Out of Scope).

### Flows

**Flow A — Creating a themed, recurring-friendly group.**
1. User taps "Create Group."
2. On the Theme field, user either selects an existing theme (e.g. "Monthly Expense," reused from last month) or picks "Add new" and types a new theme name.
3. Group is created with that theme attached, same as all other group fields work today.

**Flow B — Fast-entering a recurring expense via autocomplete.**
1. User starts a new expense within a group and starts typing the title (e.g. "Fuel").
2. As they type, the app surfaces fuzzy-matched past expenses (global search) in a suggestion list.
3. User selects a suggestion → members, amount, and category prefill from that past expense; date is today.
4. User edits amount (if it changed since last time — e.g. fuel price) and/or any other field, then saves normally.

**Flow C — Entering a genuinely new expense with no history.**
1. User types a brand-new title with no close past match (e.g. "Shell Gas Station," first time ever entering something like this).
2. No autocomplete suggestion appears (R5 doesn't fire).
3. Category auto-suggestion (R8) attempts a keyword match against the title/description; if "gas" is in the keyword dictionary mapped to a transport-like category, that category is pre-selected (still editable/overridable); otherwise defaults to "Other."
4. Whether the user accepts or changes the suggested category is logged.

**Flow D — Tagging and reviewing labeled expenses.**
1. While creating/editing an expense, user adds a Label via the shared dropdown (R7) — either picking an existing label (e.g. "Liverpool," used on a prior expense in a different group) or creating a new one.
2. Later, user opens the standalone Manage Labels screen (R4), sees "Liverpool: £340 total" summed across every group where an expense carries that label.
3. If the label was a typo or is no longer needed, the user disables it from this screen (R6) — it stops appearing in future dropdowns, but the £340 of already-labeled historical expenses keep showing "Liverpool" on them.

### Acceptance Examples

- **AE1:** Given a user has a "Monthly Expense" theme already used on 3 prior groups, when they create a new group and select "Monthly Expense" from the theme dropdown (not "Add new"), then no duplicate theme is created — the group references the existing theme record.
- **AE2:** Given a user previously entered an expense titled "Fuel" for £50, split among 2 members, categorized as the fuel-equivalent category, when they later type "Fuel" while creating a new expense and select the resulting suggestion, then the new expense form pre-populates the same 2 members and category, amount pre-fills to £50 but remains editable, and the date is today (not the date of the prior "Fuel" expense).
- **AE3:** Given the keyword dictionary maps "gas"/"fuel"/"petrol" to a transport category, when a user types a title containing "gas station" that has no close match to any past expense, then the category field pre-selects the transport category and the suggestion (and any override) is logged.
- **AE4:** Given a user has labeled 5 expenses across 3 different groups with the label "Liverpool," when they open the Manage Labels screen, then they see one "Liverpool" entry showing the sum of all 5 expenses' amounts, regardless of which group each belongs to.
- **AE5:** Given a label "Livrpool" (typo) is applied to 2 existing expenses, when the user disables it from the Manage Labels screen, then it no longer appears as a selectable option on any create/edit-expense screen, but the 2 existing expenses still display "Livrpool" as their label.

### Key Decisions

- **KTD1 — `session-settled: user-directed`.** Recurring-expense mechanism is autocomplete-and-prefill (reactive, triggered by typing), not scheduled/proactive draft-generation. Rejected alternative: a theme-scheduled background job that auto-generates a pending draft expense on a fixed date each month, requiring a new pending-expense state and a cron trigger — judged too much infrastructure for the value delivered, deferred as a possible future enhancement once the theme/autocomplete foundation is live and actual missed-entry frequency is known.
- **KTD2 — `session-settled: user-directed`.** Groups remain the unit of month-to-month organization; no persistent "Household" entity replaces or wraps them. Rejected alternative: introducing a durable household/recurring-context object that owns members and spans months, with months as sub-periods inside it — judged a much larger data-model change than the value justified right now.
- **KTD3 — `session-settled: user-directed`.** Category auto-suggestion uses keyword-dictionary matching (Splitwise's public, proven approach), not ML/NLP classification or an LLM API call. Rejected alternatives: a trained classifier (cold-start problem — no benefit until a user has significant history) and an LLM call (per-request cost, latency, and sends expense descriptions to a third party) — both deferred as possible future graduations once the logged suggestion/override data (R8) exists to justify the investment.
- **KTD4 — `session-settled: user-directed`.** Autocomplete/title-match suggestions search **globally** across all of a user's past expenses, not scoped to the current group's theme. Rejected alternative: theme-scoped-only or theme-scoped-with-global-fallback — judged unnecessary complexity for a single lookup.
- **KTD5 — `session-settled: user-directed`.** Theme, Category, and Label all share one lifecycle rule (disable, not hard-delete) and one dropdown UX (Add-new-first, type-ahead filtering on existing values) — extended by inference from the user's explicit Label-deletion answer to the other two types for interaction consistency; flagged in dialogue as an assumption, not independently probed for Theme/Category.
- **KTD6 — `session-settled: user-directed`.** Fixed KPI/settlement dashboard, scheduled recurring generation, open-ended natural-language expense Q&A, and ML/LLM-based category prediction are all explicitly out of scope for this plan (see Out of Scope) — this plan is infra-only, by explicit user redirect mid-brainstorm ("i dont want a fixed view first... first build whats more infra specific").

### Out of Scope

- **Fixed KPI/settlement dashboard** (per-person balance trends, category spend trends, settlement-status-per-month) — explored in dialogue, three concrete view candidates discussed, but the user redirected to prioritize infrastructure first. A future plan can build these views as a direct consumer of Theme (R1) and Label (R3) once this infra ships.
- **Scheduled/proactive recurring-expense generation** ("auto-draft an expense on the 31st for review") — the theme-scheduled background-job mechanism explored and rejected in favor of R5's simpler autocomplete approach (KTD1). May be revisited as a genuine future enhancement.
- **Open-ended natural-language expense Q&A** ("average Tesco spend per month," free-text queries with charts) — this is the existing Phase 8 "AI expense Q&A" roadmap item (with its own hard constraint: LLM only translates to a structured query, never computes numbers itself). Explicitly kept as its own separate future brainstorm rather than folded into this plan.
- **ML/LLM-based category prediction** — deferred per KTD3; R8's logged suggestion/override data is the explicit on-ramp for revisiting this later, not something this plan builds.

### Assumptions

- The keyword dictionary (R8) ships with a small starter set per category, informed by publicly known examples like Splitwise's approach, rather than launching empty — exact seed list is a planning-stage detail.
- "Last-used category" as an R8 fallback (vs. always defaulting to "Other") is left as an open implementation choice for planning to resolve; either is acceptable per the brainstorm dialogue.
- The Manage Labels screen's per-label total (R4) is a simple sum query, not a themed/time-bucketed breakdown — that level of detail belongs to the deferred dashboard.

## How This Work Fits Together

This plan is explicitly the first of at least three related future pieces, per the user's own framing during the brainstorm:
1. **This plan** — Theme, Label, extensible Category, autocomplete, keyword-based category suggestion (infra).
2. **Future — Settlement/KPI dashboard** — consumes Theme (and possibly Label) to show per-person balances, spend trends, and settlement status over time across linked groups. Explicitly deferred, not started.
3. **Future — Natural-language expense Q&A** (existing Phase 8 item) — consumes the same underlying data (and possibly benefits from R8's logged category signal) to answer arbitrary questions like "average Tesco spend per month." Explicitly kept separate, not started.

These relationships are tentative and may be revised, split further, or merged differently once planning for piece 1 is underway.
