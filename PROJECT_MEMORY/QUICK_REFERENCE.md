# ⚡ Quick Reference - v0.3.3 Changes

**Status:** 🟡 PARTIALLY STALE (April 25, 2026) - Some patterns still valid, some outdated  
**Use For:** Quick pattern reminders (array indexing, bug summary)  
**Navigation:** See [01-MASTER_STATE.md](./01-MASTER_STATE.md#-documentation-navigation) for index

## What Was Done (April 18, 2026)
✅ Fixed 10 bugs discovered in mobile testing  
✅ Added expense list sorting (newest first) + running balance  
✅ Expert UX review completed - redesign spec ready  
✅ All changes committed (commit: 7d36873)

## Critical Array Indexing Pattern (REMEMBER!)
```typescript
// For AMOUNT/PERCENTAGE splits with payer at index 0:
// DB: [payer_amount, member1_amount, member2_amount, ...]
// When loading:
const payerAmount = splitAmount[0];  // ← payer at index 0
const member1Amount = splitAmount[1]; // ← members at 1+
const member2Amount = splitAmount[2];

// When saving (in getSplitPayload):
const allIds = [paidById, ...splitWithIds]; // ← [payer, members]
payload.splitAmount = allIds.map((id, idx) => 
  formAmounts[idx] // ← Automatically handles offset
);
```

## 10 Bugs Fixed in v0.3.3
1. 🔴 **Auth token expiration** → 401 detection + auto-logout
2. 🔴 **Payer duplication** → useEffect cleanup for paidById changes
3. 🔴 **Missing payer AMOUNT field** → Added input (parity with PERCENTAGE)
4. 🔴 **AMOUNT payload missing payer** → Changed to [payer, ...members]
5. 🔴 **AMOUNT prefill broken** → Fixed index offset (payer[0], members[1+])
6. 🔴 **No split breakdown display** → Added calculateMemberShare() helper
7. 🔴 **Duplicate members** → Added dedupe in addMember() + Set on load
8. 🔴 **Negative amounts allowed** → Input validation rejects '-' prefix
9. 🔴 **Missing group data** → Defensive checks for _count, totalAmount
10. 🔴 **Silent save errors** → Show validation errors in Alert

## 2 UX Enhancements Added
1. ✅ **Expense sorting** - Newest first, deterministic (then ID)
2. ✅ **Running balance** - Cumulative user share + total visible per line

## Next Session: Phase 1 UI Redesign (1 hour, 40-50% scroll reduction)
```typescript
// TODO: Create AccordionSection component
// TODO: Move Notes → accordion
// TODO: Sticky footer for Save/Cancel
// TODO: Category → horizontal scroll
// Expected: ~700px → ~350px (50% less scrolling)
```

## Key Files to Review Before Phase 1
- EditExpenseScreen.tsx (125 lines, orchestrator)
- EditExpenseScreen/hooks/useSplitCalculator.ts (172 lines, dedup cleanup)
- EditExpenseScreen/components/SplitMembersInput.tsx (336 lines, split UI)
- PROJECT_MEMORY/08-UX_REDESIGN_SPEC.md (detailed implementation spec)

## Testing Checklist for Phase 1
- [ ] Create + Edit expense works with accordion Notes
- [ ] Sticky footer doesn't block inputs
- [ ] Category horizontal scroll works on mobile
- [ ] No render errors
- [ ] Expo Go loads without crashes

## Roll-back If Needed
`git revert 7d36873` - Returns to v0.3.2 state (but keep this version - it's solid)
