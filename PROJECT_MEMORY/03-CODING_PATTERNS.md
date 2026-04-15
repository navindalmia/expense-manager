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
