#  Feature Testing Checklist

This file reminds you to add tests when building new features.

---

##  Testing Strategy Decision

**When to write tests?**

 **Decision: Code First, Tests After (Approach 2)**

```
Workflow:
1. Build feature (service/component)
   └─ Make it work manually
   
2. Write tests immediately after
   └─ Lock in the behavior
   
3. Before commit
   └─ Verify tests pass
   └─ Check coverage (backend: 80%+)
   
4. Commit with code + tests together
```

**Why this approach?**
- ✅ Requirements change frequently (multilingual, split types, edge cases)
- ✅ Easier to explore and experiment with code first
- ✅ Tests become verification, not guesses
- ✅ When requirements change → update code + tests together
- ✅ Faster feedback loop

**NOT doing TDD (Test-Driven Development)?**
- ❌ Too slow for exploratory work
- ❌ Requirements not always clear upfront
- ❌ Changes would require rewriting tests anyway

---

## Backend Features

**When you create a new service/feature:**

```
Feature: User CRUD endpoints
├─ [ ] Service file created: src/services/userService.ts
├─ [ ] Test file created: src/services/__tests__/userService.test.ts
├─ [ ] Tests cover:
│   ├─ [ ] Happy path (successful operation)
│   ├─ [ ] Error cases (validation, not found, etc.)
│   ├─ [ ] Edge cases (empty, null, boundary values)
│   └─ [ ] Multilingual errors (throw AppError with key)
├─ [ ] Run: npm test (all pass)
├─ [ ] Coverage: npm run test:coverage (80%+)
└─ [ ] Commit with test coverage info
```

**Example Commit Message:**
```
feat: add user CRUD endpoints
- Created userService with create/read/delete operations
- Added 12 unit tests covering happy/error paths
- Test coverage: 85%
- Tested error messages in en/fr
```

---

## Frontend Features

**When you create a new component/screen:**

```
Feature: ExpenseListScreen component
├─ [ ] Component created: src/screens/ExpenseListScreen.tsx
├─ [ ] Test file created: src/screens/__tests__/ExpenseListScreen.test.tsx
├─ [ ] Tests verify:
│   ├─ [ ] Component renders without crashing
│   ├─ [ ] Button exists and is clickable
│   ├─ [ ] Correct API endpoint is called
│   ├─ [ ] Accept-Language header is sent
│   └─ [ ] (Skip error mocking tests - manual test instead)
├─ [ ] Run: npm test (all pass)
└─ [ ] Commit with test status
```

**Example Commit Message:**
```
feat: add ExpenseListScreen component
- Displays list of expenses with loading/error states
- Added 2 unit tests (component render, API call verification)
- Manual testing: loading/error states work correctly
```

---

## Testing Status by Phase

| Phase | Backend Tests | Frontend Tests | Status |
|-------|---|---|---|
| **Phase 1** (Expenses CRUD) | ✅ Implemented | ⏳ Minimal | Complete |
| **Phase 2** (Frontend Bridge) | N/A | ⏳ Minimal | In Progress |
| **Phase 3** (Users & Categories) | ⏳ To Add | ⏳ Minimal | Pending |
| **Phase 4** (Auth) | ⏳ To Add | ⏳ Minimal | Pending |

---

## Quick Reference

### Backend Test Template
```typescript
// Test business logic, not mocks
describe('ServiceName', () => {
  it('should [do something] when [condition]', async () => {
    // Mock Prisma to return expected data
    (prisma.model.operation as jest.Mock).mockResolvedValue(expectedData);
    
    // Call service
    const result = await service.operation(input);
    
    // Verify service passed CORRECT DATA to Prisma
    expect(prisma.model.operation).toHaveBeenCalledWith(
      expect.objectContaining({ ... })
    );
  });
});
```

### Frontend Test Template
```typescript
// Test component behavior, not mocks
describe('ComponentName', () => {
  it('should render', () => {
    render(<Component />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
  
  it('should call API with correct params', () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    render(<Component />);
    fireEvent.click(screen.getByRole('button'));
    
    expect(axios.get).toHaveBeenCalledWith('/api/endpoint', {
      headers: { 'Accept-Language': 'en' }
    });
  });
});
```

---

---

**Remember:** I'll remind you to add tests for each feature. This is here as reference.
