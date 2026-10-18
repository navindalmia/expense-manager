---
title: "updateGroup() returned the raw response envelope, silently breaking the group-list optimistic update"
date: 2026-09-18
category: docs/solutions/logic-errors
module: groupService / HomeScreen / EditGroupModal
problem_type: logic_error
component: frontend_service
symptoms:
  - "Editing a group's name, description, or currency in EditGroupModal appeared to save (no error shown) but the group list on HomeScreen kept showing the old value"
  - "A manual pull-to-refresh always showed the correct, updated value"
root_cause: logic_error
resolution_type: code_fix
severity: medium
related_components: ["frontend_service", "state_management"]
tags: [axios, response-envelope, react-state, optimistic-update, groups]
---

# updateGroup() returned the raw response envelope, silently breaking the group-list optimistic update

## Problem

`frontend/src/services/groupService.ts`'s `updateGroup()` was:

```ts
export async function updateGroup(groupId: number, data: UpdateGroupDTO): Promise<Group> {
  const response = await http.patch<Group>(`/groups/${groupId}`, data);
  return response.data;
}
```

The backend's actual response shape (`backend/src/controllers/groupController.ts`'s `updateGroup` handler) is `{ success: true, data: group, message: '...' }`. `response.data` is therefore the whole envelope object, not the `Group` — but the function's return type (`Promise<Group>`) claimed otherwise, so TypeScript gave no warning at any call site.

## Symptoms

Filed as GitHub issue #44: "Currency sync issue in Expense Group edit... does not update and needs a tap refresh." The same applied to editing a group's name or description, not just currency — the issue title undersold the actual scope.

## Root Cause

`HomeScreen.tsx`'s `handleEditSuccess(updatedGroup)` does an optimistic list update:

```ts
setGroups((prevGroups) =>
  prevGroups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g))
);
```

`updatedGroup` was actually the `{ success, data, message }` envelope, so `updatedGroup.id` was always `undefined`. `g.id === undefined` never matched any real group, so the `.map()` returned every item unchanged — the state update ran (a new array reference was created, so no crash and no visible error) but had no effect. Only `loadGroups()` (triggered by pull-to-refresh, which re-fetches from `GET /groups` and correctly unwraps its own response) ever showed the real value.

This is the same bug class already correctly handled two lines away in the same file — `addMemberByEmail()` does `return { data: response.data.data, addedMember: response.data.addedMember }` — but `updateGroup()` was never brought in line with that pattern.

## Solution

```ts
export async function updateGroup(groupId: number, data: UpdateGroupDTO): Promise<Group> {
  const response = await http.patch<{ success: boolean; data: Group; message: string }>(
    `/groups/${groupId}`,
    data
  );
  return response.data.data;
}
```

Typing the response as the actual envelope shape (rather than claiming it's already `Group`) makes the `.data.data` unwrap both correct and self-documenting.

## Why This Works

Once the function returns the real `Group`, `updatedGroup.id` is the actual group id, and `HomeScreen`'s existing `.map()` — which was always correct — starts matching and replacing the right list item immediately, with no other change needed anywhere else in the call chain.

## Prevention

- When wrapping an HTTP client call in a typed service function, type the *response* generic as what the endpoint actually returns (the full envelope), not what you intend to hand back to the caller — then unwrap explicitly. Typing the generic as the already-unwrapped shape (as this function did) silences the type-checker exactly where it would otherwise catch the mismatch.
- When one function in a service file already has the correct unwrap-envelope pattern (here, `addMemberByEmail`), a sibling function added later without following the same pattern is a signal worth checking for during review — a quick grep for `response.data` vs `response.data.data` in the same file surfaces the inconsistency immediately.
- An optimistic list update that "succeeds" (new array reference, no thrown error) can still be a complete no-op if the id it's matching on is silently `undefined` — this class of bug produces no console error and no failed network request, only a UI that looks like it ignored the user's edit.

## Related Issues

- GitHub issue #44 (this fix).
- GitHub issue #59 — `getGroups()` and `deleteGroup()` in the same file have the identical unwrap bug, currently latent because neither is called anywhere in the frontend yet. Filed rather than fixed alongside this change, since neither is causally connected to #44's fix.
