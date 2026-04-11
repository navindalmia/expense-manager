# Expense Manager - Test & Development Plan

## Current Issues to Fix
1. **Category Hardcoding** - Categories in CreateExpenseScreen are hardcoded, should be fetched from backend
2. **Group Name Display** - Ensure group name displays in ExpenseListScreen header
3. **Expense Creation Flow** - Create expense form and backend integration
4. **Group Management** - Edit/delete groups functionality

## Test Cases to Generate & Execute

### API Tests (Backend)
- [ ] GroupService: getUserGroups returns groups with totalAmount
- [ ] GroupService: updateGroup saves changes correctly
- [ ] ExpenseService: createExpense stores expense with groupId
- [ ] ExpenseService: getGroupExpenses returns only group expenses
- [ ] Category endpoints: GET /categories returns all categories
- [ ] Auth: All endpoints require valid JWT

### UI Tests (Frontend)
- [ ] HomeScreen: Displays list of groups with total amount
- [ ] HomeScreen: Edit button opens EditGroupModal
- [ ] ExpenseListScreen: Displays correct group name in header
- [ ] ExpenseListScreen: Add button navigates to CreateExpenseScreen
- [ ] CreateExpenseScreen: Form submits expense with all fields
- [ ] CreateExpenseScreen: Categories dropdown populates from API

### Integration Tests
- [ ] User can create group → add expense → see total update
- [ ] User can edit group → name updates in list
- [ ] User can create expense → appears in list immediately

## Status
- Backend Services: Need unit test updates
- Frontend Services: Need Vitest implementation
- Components: Need React component tests
- Integration: Needs E2E test setup

## Success Criteria
- All backend tests passing
- All frontend tests passing
- All integration tests passing
- No hardcoded data (categories from API)
- Group name displays correctly
- Expense creation works end-to-end
