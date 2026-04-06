# QA Test Plan - Group Management & Data Scoping

**Date:** April 6, 2026  
**Status:** Issues Identified - Test Cases Created

---

## **Issues Identified**

### **Issue 1: Group Creation UX - Missing User Invitation**
**Severity:** HIGH  
**Description:** When creating a group, app doesn't ask for email addresses of users to add to group  
**Expected:** After group creation, prompt user to add members via email  
**Actual:** Group created but no member invitation flow

**Test Case 1.1: Add members during group creation**
```
1. On HomeScreen, tap "+ New" button
2. Fill group details (name, description, currency)
3. After group created, app should show "Add Members" screen
4. User enters email: "friend@example.com"
5. Tap "Add Member" button
6. Member added to group successfully
7. Verify member appears in group member list
```

**Test Case 1.2: Send WhatsApp invite link**
```
1. After adding member, show "Share Invite Link" option
2. Tap "Share via WhatsApp"
3. WhatsApp opens with pre-filled message:
   "Join my expense group: [group-name]
    Link: http://localhost:4000/groups/[id]/join?token=[invite-token]"
4. Member receives invite and can join
```

---

### **Issue 2: No Group Edit Functionality**
**Severity:** MEDIUM  
**Description:** Created group cannot be edited (name, description, currency)  
**Expected:** Group card has edit button that allows modifications  
**Actual:** No edit option available

**Test Case 2.1: Edit group details**
```
1. On HomeScreen, long-press on group card (or tap menu icon)
2. Tap "Edit Group" option
3. Modal shows group name, description, currency editable
4. Change name to "Trip to Paris"
5. Tap "Save Changes"
6. Verify group name updated in list immediately
7. Backend persists changes to database
```

---

### **Issue 3: Group Not Appearing After Creation (Requires Refresh)**
**Severity:** HIGH  
**Description:** After creating group, it doesn't appear in HomeScreen list until manual refresh  
**Expected:** Group appears immediately after creation  
**Actual:** Group only appears after pull-to-refresh

**Test Case 3.1: Instant group appearance**
```
1. On HomeScreen, tap "+ New"
2. Fill form (name: "New Trip", amount: "100", currency: "USD")
3. Tap "Create Group"
4. Loading spinner shows
5. API request returns 201 success
6. Group automatically appears at top of list
7. NO manual refresh needed
```

---

### **Issue 4: Orphan Expenses Showing in Group**
**Severity:** CRITICAL  
**Description:** Group shows expenses that were never added to that group (orphan data)  
**Expected:** Each group shows ONLY expenses added to that specific group  
**Actual:** Expenses from other groups or ungrouped expenses visible

**Test Case 4.1: Expense isolation by group**
```
1. Create Group A: "Trip 1"
2. Create Group B: "Trip 2"
3. Add Expense 1 to Group A (amount: 100)
4. Add Expense 2 to Group B (amount: 200)
5. Open Group A - should show ONLY Expense 1 (100)
6. Verify Expense 2 (200) NOT visible
7. Open Group B - should show ONLY Expense 2 (200)
8. Verify Expense 1 (100) NOT visible
```

**Test Case 4.2: Verify database relationships**
```
Backend validation:
1. GET /api/groups/[groupId]/expenses
2. Where clause: expenses.groupId = [groupId]
3. Should NOT return expenses where groupId != [groupId]
4. Should NOT return expenses with NULL groupId
```

---

## **Test Execution Plan**

### **Phase 1: Backend Fixes** (2-3 hours)
- [ ] Create GROUP_MEMBERS junction table in Prisma
- [ ] Create UPDATE group endpoint
- [ ] Add GET group expenses with groupId filtering
- [ ] Create member invitation logic with tokens
- [ ] Add tests for data isolation

### **Phase 2: Frontend Fixes** (3-4 hours)
- [ ] Add "Add Members" modal to CreateGroupScreen
- [ ] Add WhatsApp share functionality
- [ ] Add "Edit Group" option in HomeScreen
- [ ] Implement optimistic cache update after group creation
- [ ] Fix ExpenseListScreen to filter by groupId

### **Phase 3: Mobile Testing** (1-2 hours)
- [ ] Test all scenarios on Expo mobile device
- [ ] Verify no orphan data appears
- [ ] Test WhatsApp integration
- [ ] Test edit and member addition flows

---

## **Affected Endpoints/Components**

**Backend:**
- POST /api/groups (check: no orphan expenses)
- PATCH /api/groups/:id (NEW)
- GET /api/groups/:id/expenses (FIX: add groupId filter)
- POST /api/groups/:id/members (NEW)
- POST /api/groups/:id/invite (NEW)

**Frontend:**
- CreateGroupScreen.tsx (ADD: member modal)
- HomeScreen.tsx (FIX: cache update, ADD: edit option)
- ExpenseListScreen.tsx (FIX: groupId filter in query)
- NEW: GroupMembersModal.tsx
- NEW: EditGroupModal.tsx
- NEW: WhatsAppShare.ts utility

---

## **Success Criteria**

✅ All 4 test cases pass on mobile device  
✅ No orphan expenses in any group  
✅ Group appears immediately after creation  
✅ Members can be added and invited  
✅ WhatsApp invite works  
✅ Group edit functionality works  
✅ All backend tests pass  
✅ All frontend tests pass

