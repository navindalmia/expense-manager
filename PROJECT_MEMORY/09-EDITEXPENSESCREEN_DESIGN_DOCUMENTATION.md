# EditExpenseScreen UX Redesign — Remaining Spec (Phase 2-3)

**Status:** Phase 1 shipped (AccordionSection component, Notes accordion, sticky footer, horizontal-scroll categories — see `frontend/src/components/AccordionSection.tsx` and `frontend/src/screens/EditExpenseScreen.tsx`). Phase 2 and 3 below are **not started**. This doc only covers what's still unbuilt; Phase 1 detail lives in git history if needed.

**Problem this addresses:** "Too much scrolling for too little data" — original analysis found the Split section alone was 40-50% of scroll height, with 9 sequential form sections adding another 20-30%.

---

## Phase 2: Core Redesign (targets 65-70% total scroll reduction, ~1.5h, medium risk — layout restructure)

1. **Essentials Card** — consolidate Title, Amount, Currency, Paid By, Category, Date into one card (~120-150px), replacing separate sequential sections.
2. **Move Split to an accordion** (same `AccordionSection` pattern used for Notes) — collapsed by default when creating, expanded if editing an expense that already has splits; show `${splitWithIds.length} members, ${splitType}` in the collapsed subtitle.
3. **Move group name to a sticky header** — `← EditExpense | Group: {groupName}`, out of the scrollable content.
4. **Tighten spacing** — form section margins 16px→12px, input padding 10px→8px.

## Phase 3: Polish (~30min, low risk)

1. Replace the disabled date TextInput with a button + calendar icon showing the formatted date inline.
2. Move error messages inline next to fields (red border on invalid fields) instead of below the form.
3. Animate accordion expand/collapse (`Animated.timing`, ~200ms).

Note: "auto-focus amount field after category/date selection" (a related small UX item) is already tracked separately in `ROADMAP.md` Phase 5c.

---

## Design principles (carry over from Phase 1)

Progressive disclosure (hide optional fields by default), sticky affordances (Save/Cancel always reachable), density over whitespace, consistency (same accordion pattern for every collapsible section).
