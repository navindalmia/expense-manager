# Coding Patterns & Conventions

**For the Expense Manager project**

---

## 🗄️ DATABASE PATTERNS (Prisma)

### Relationship Creation
```typescript
// ✅ CORRECT: Connect existing relationship
group: { connect: { id: groupId } }

// ❌ WRONG: Don't pass both field AND relationship
{ groupId, group: { connect: { id: groupId } } }

// ✅ RIGHT: Use relationship OR direct field, not both
expense: { groupId: 1 }  // Simple field assignment
OR
expense: { group: { connect: { id: 1 } } }  // Relation
```

### Soft Deletes
```prisma
// Mark items as deleted, don't hard delete
isActive Boolean @default(true)

// In queries, always filter:
where: { 
  expenses: { 
    isActive: true 
  }
}
```

### Migration Gotchas
```bash
# If migration fails with existing data:
npx prisma migrate reset --force
# This:
# 1. Drops all tables
# 2. Runs all migrations from scratch
# 3. Re-seeds data
```

---

## 🔌 API PATTERNS

### Error Handling with AppError
```typescript
throw new AppError(
  'MEMBER.NOT_FOUND',      // i18n translation key
  404,                     // HTTP status
  'MEMBER_NOT_FOUND',      // error code (frontend uses this)
  { memberId: 5 }          // optional metadata
);
```

### Input Validation with Zod
```typescript
const schema = z.object({
  name: z.string().min(1, 'Name required'),
  amount: z.number().positive('Amount must be > 0'),
  date: z.string().datetime(),
});

// This catches errors and converts to AppError automatically
const parsed = schema.parse(req.body);
```

### Response Format
```typescript
// ✅ Consistent JSON responses
res.json({
  success: true,
  data: expense,
  message: 'Expense created'
});

res.status(400).json({
  success: false,
  error: 'VALIDATION_ERROR',
  message: 'Invalid amount'
});
```

---

## 💻 FRONTEND PATTERNS (React Native)

### Hook for Auto-Refresh
```typescript
import { useFocusEffect } from '@react-navigation/native';

// Refresh data when screen comes into focus
useFocusEffect(
  useCallback(() => {
    loadExpenses();
  }, [])
);
```

### Modal State Management
```typescript
const [isModalOpen, setIsModalOpen] = useState(false);

// Pass state down, keep modal close button in modal component
<Modal 
  visible={isModalOpen}
  onClose={() => setIsModalOpen(false)}
/>
```

### Comment Out APIs Until Ready
```typescript
// TODO: Call actual API when ready
// const response = await fetch('http://localhost:4000/api/expenses');

// For now, test with mock data
const expenses = [];
```

---

## 🧪 TESTING PATTERNS

### Mock Setup Pattern
```typescript
beforeEach(() => {
  jest.clearAllMocks();
  (prisma.group.findUnique as jest.Mock).mockResolvedValue({
    id: 1,
    name: 'Test Group',
    members: [{ id: 1 }, { id: 2 }],
  });
});
```

### Test Structure (AAA Pattern)
```typescript
it('should create expense for group member', async () => {
  // ARRANGE
  const groupId = 1;
  const expense = { amount: 100, category: 'FOOD' };
  
  // ACT
  const result = await expenseService.create(groupId, expense);
  
  // ASSERT
  expect(result.id).toBeDefined();
  expect(result.groupId).toBe(groupId);
});
```

### Split Calculation
```typescript
// Amount divided by (splitWithIds.length + 1) to include payer
// Example: $25 split 3 ways = $8.33 each
// If user passes splitWithIds: [2, 3] (not including self)
// Service adds payer (1) to get [1, 2, 3] = 3 people
```

---

## 🔤 TYPESCRIPT PATTERNS

### Type Casting When Needed
```typescript
return prisma.expense.create({
  data: cleanData({...}) as unknown as Prisma.ExpenseCreateInput,
});
// Needed when cleanData removes optional fields
```

### Enum Conversion
```typescript
const cleanData = {
  ...parsed,
  currency: parsed.currency as Currency,
  splitType: parsed.splitType as SplitType,
};
```

### No Implicit `any`
```typescript
// ❌ WRONG
const expense = req.body;

// ✅ RIGHT
const expense: Expense = req.body;
// OR with validation
const expense = await expenseSchema.parse(req.body);
```

---

## � DATE HANDLING (Mobile-Specific)

### Timezone Problems with Dates
```typescript
// ❌ WRONG: Causes timezone issues on mobile
const date = new Date("2026-04-13");
// Result: May show as April 12 in some timezones

// ✅ RIGHT: Use string format YYYY-MM-DD throughout
const dateStr = "2026-04-13";

// Only parse for display
const dateObj = new Date(`${dateStr}T00:00:00Z`);
```

### Future Date Prevention
```typescript
// Function to check if date is in future
const isFutureDate = (day: number, month: number, year: number) => {
  const dateToCheck = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);  // Clear time
  return dateToCheck > today;
};

// Disable in UI
disabled={isFutureDate(day, month, year)}
```

---

## 💰 SPLIT CALCULATIONS (Important!)

### Split Array Storage Format (Backend → Frontend)

**CRITICAL: Array storage does NOT include payer**

```typescript
// Backend Storage (expenseService.ts):
// splitWithIds = [1, 2]               // Member IDs ONLY (not payer)
// splitAmount = [25, 25]              // INDEXED by member: [member0_amt, member1_amt]
// splitPercentage = [50, 50]          // INDEXED by member: [member0_%, member1_%]
// paidById = 3                        // Payer is SEPARATE

// Frontend State (useSplitCalculator):
// splitWithIds: [1, 2]
// splitAmount: { 1: '25', 2: '25' }           // Map for manipulation
// splitPercentage: { 1: '50', 2: '50' }       // Map for manipulation
// paidById: 3

// Frontend Loading (EditExpenseScreen.tsx prefillFromExpense):
expense.splitWith.forEach((user, idx) => {
  // user = expense.splitWith[idx]           // Get member object
  // expense.splitAmount[idx]                // Direct array index
  updateAmount(user.id, expense.splitAmount[idx].toString());
});
// ✅ Result: { 1: '25', 2: '25' } in state

// ❌ OLD (WRONG - caused NaN):
expense.splitWith.forEach((user, idx) => {
  if (expense.splitPercentage?.[idx + 1]) {  // ← Offset by 1 = wrong index!
    updatePercentage(user.id, expense.splitPercentage[idx + 1].toString());
  }
});
```

**Why this matters:**
- Backend divides by `splitWithIds.length` (members only)
- If payer was included in array, payer would be counted twice (once in split, once as payer)
- Frontend loading must use DIRECT indexing: `[0, 1, 2, ...]` for members, NOT `[1, 2, 3, ...]`

### Initialization Sequence (MUST NOT REORDER)

```typescript
// EditExpenseScreen.tsx:

// STEP 1: Load data (parallel)
const { expense, categories, groupMembers, loading } = useExpenseData(expenseId, groupId);

// STEP 2: Create hooks (expense causes rerender → paidById changes)
const { formState, prefillFromExpense } = useExpenseForm(expense);
const { splitState, addMember, ... } = useSplitCalculator(
  formState.amount,
  formState.paidById,  // ← Sets when prefillFromExpense runs
  groupMembers,
  expense              // ← NEW: Prevents override on load
);

// STEP 3: Effects that populate state
useEffect(() => {
  if (expense) {
    prefillFromExpense(expense);  // ← Sets paidById (rerender trigger)
    
    if (expense.splitWith?.length > 0) {
      const uniqueMemberIds = [...new Set(expense.splitWith.map(u => u.id))];
      uniqueMemberIds.forEach(userId => addMember(userId));  // ← Populate
      
      // Load values with DIRECT indexing
      expense.splitWith.forEach((user, idx) => {
        if (expense.splitPercentage?.[idx]) {
          updatePercentage(user.id, expense.splitPercentage[idx].toString());
        }
      });
    }
  }
}, [expense]);

// useSplitCalculator.ts - CRITICAL EFFECT:
useEffect(() => {
  setSplitState(prev => {
    // PROTECTION: Check if loading saved expense
    if (savedExpense?.splitWith && savedExpense.splitWith.length > 0) {
      return prev;  // ← Skip reinitialization!
    }
    
    // Only reinitialize for NEW expenses
    const newMembers = groupMembers.filter(m => m.id !== paidById).map(m => m.id);
    // ... populate with all members
  });
}, [paidById, groupMembers.length, savedExpense?.splitWith?.length]);
```

**Key Protection:**
- If loading saved expense: `if (savedExpense?.splitWith?.length > 0)` → EXIT
- Allows addMember() calls to populate saved members
- Only reinitializes on NEW expenses

**Common Mistake:**
- Passing NEW expense data resets splitWithIds to all members
- Then addMember() calls don't override the reset
- Result: Shows split with all members instead of saved subset

### Personal Share Formula
```typescript
// EQUAL split: Divide total equally
personalShare = amount / (numMembers + 1)  // +1 includes payer

// AMOUNT split: You pay the remainder
personalShare = amount - sum(otherAmounts)

// PERCENTAGE split: You pay remaining %
personalShare = amount * (100 - sum(otherPercentages)) / 100
```

### For PERCENTAGE Splits - Include Yourself
```typescript
// When user selects PERCENTAGE type, show:
// [payer, ...selectedMembers]  <- Payer included!
// Each person gets % input field including you

// Validation: sum of all % must = 100%
const totalPercent = Object.values(percentages).reduce((a, b) => a + b, 0);
if (Math.abs(totalPercent - 100) > 0.01) {
  error = 'Percentages must sum to 100%';
}
```

### Backend Split Recalculation
```typescript
// Always recalculate on server, don't trust client
if (payloadSplitType === 'EQUAL') {
  // Auto-calculate: divide by # of people
  const perPerson = newAmount / (splitWithIds.length + 1);
  splitAmount = [perPerson, perPerson, ...];
} else if (payloadSplitType === 'PERCENTAGE') {
  // Validate: all percentages sum to 100
  // Calculate amounts from percentages
}
```

---

## �📝 GIT COMMIT PATTERNS

```bash
# Database changes
git commit -m "feat: stabilize database with groups model"

# Testing additions
git commit -m "test: add expenseService tests with 85% coverage"

# Bug fixes
git commit -m "fix: prevent duplicate groupId in expense create"

# Feature completion
git commit -m "feat: add expense create/edit/list flows"
```

---

## ⚠️ COMMON MISTAKES

❌ Passing both `groupId` and `group: { connect }` together  
❌ Forgetting to include `members` when querying Groups  
❌ Hard-deleting instead of soft-deleting with `isActive: true`  
❌ Not mocking database in tests before operations  
❌ Using old column names after migrations  
❌ Hardcoding values instead of using environment variables  

---

## ✅ BEST PRACTICES

✅ Always use Zod for input validation (backend)  
✅ Throw AppError with i18n keys (multilingual support)  
✅ Use soft deletes (`isActive`) not hard deletes  
✅ Write tests immediately after feature code  
✅ Use TypeScript strict mode  
✅ Comment WHY, not WHAT (code shows what)  
✅ Keep functions <50 lines  
✅ Use meaningful variable names  
