# EditExpenseScreen Restructuring Proposal

## Current State Analysis

**File**: `frontend/src/screens/EditExpenseScreen.tsx` (1,050 lines)

### State Management (18 useState hooks)

#### Form Input State (8 state vars)
```typescript
const [title, setTitle] = useState('');
const [amount, setAmount] = useState('');
const [category, setCategory] = useState<number | null>(null);
const [paidById, setPaidById] = useState<number | null>(null);
const [notes, setNotes] = useState('');
const [date, setDate] = useState('');
const [tempDate, setTempDate] = useState(date);
const [showDatePicker, setShowDatePicker] = useState(false);
const [showPayerModal, setShowPayerModal] = useState(false);
const [loading, setLoading] = useState(false);
const [errors, setErrors] = useState<Record<string, string>>({});
```
**Responsibility**: User input capture, form UI state

#### Split Configuration State (4 state vars)
```typescript
const [splitType, setSplitType] = useState<SplitType>('EQUAL');
const [splitWithIds, setSplitWithIds] = useState<number[]>([]);
const [splitAmount, setSplitAmount] = useState<Record<number, string>>({});
const [splitPercentage, setSplitPercentage] = useState<Record<number, string>>({});
```
**Responsibility**: Split calculation logic - EQUAL/AMOUNT/PERCENTAGE splitting

#### Data Fetching State (4 state vars)
```typescript
const [expense, setExpense] = useState<Expense | null>(null);
const [categories, setCategories] = useState<Category[]>([]);
const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
const [isLoadingData, setIsLoadingData] = useState(true);
const [dataError, setDataError] = useState<string | null>(null);
```
**Responsibility**: Server data fetching & caching

### Custom Hooks / Callbacks (5 main functions)

1. **`useEffect` (data fetching)** - Lines 504-575
   - Fetches expense, categories, group members
   - Pre-fills all form fields
   - Loads split amounts/percentages based on split type
   - **Complexity**: HIGH - loads 3 data sources, transforms split data

2. **`removeMemberFromSplit(memberId)`** - Lines 577-594
   - Removes member from splitWithIds
   - Clears their amount/percentage
   - **Complexity**: LOW - simple state cleanup

3. **`validateForm()`** - Lines 596-630
   - Validates title, amount, category, payer
   - Validates split constraints (AMOUNT sum, PERCENTAGE = 100%)
   - **Complexity**: MEDIUM - multi-rule validation logic

4. **`handleUpdate()`** - Lines 632-688
   - Constructs payload with split calculation logic
   - Calls updateExpense API
   - Handles error/success
   - **Complexity**: HIGH - payload construction, API call

5. **`SimpleCalendar()` component** - Lines 710-900
   - Embedded calendar component (150 lines)
   - Date selection, future date validation
   - **Complexity**: MEDIUM - date logic

---

## Proposed Structure

### Strategy: Extract by Responsibility

#### New File 1: `hooks/useExpenseForm.ts` (200 lines)
**Purpose**: Form input state management

```typescript
interface FormState {
  title: string;
  amount: string;
  category: number | null;
  paidById: number | null;
  notes: string;
  date: string;
  loading: boolean;
  errors: Record<string, string>;
}

export function useExpenseForm(initialExpense: Expense) {
  const [formState, setFormState] = useState<FormState>({...});
  
  const updateField = (field: keyof FormState, value: any) => {...};
  const setError = (field: string, msg: string) => {...};
  const clearErrors = () => {...};
  
  return { formState, updateField, setError, clearErrors };
}
```

**Exports**:
- `useExpenseForm()` hook
- `FormState` type
- All form state management

**Tests**: Easy to unit test form state changes

---

#### New File 2: `hooks/useSplitCalculator.ts` (180 lines)
**Purpose**: Split calculation logic (EQUAL/AMOUNT/PERCENTAGE)

```typescript
interface SplitState {
  splitType: SplitType;
  splitWithIds: number[];
  splitAmount: Record<number, string>;
  splitPercentage: Record<number, string>;
}

export function useSplitCalculator(amount: string) {
  const [splitState, setSplitState] = useState<SplitState>({...});
  
  const addMember = (memberId: number) => {...};
  const removeMember = (memberId: number) => {...};
  const updateAmount = (memberId: number, amount: string) => {...};
  const updatePercentage = (memberId: number, pct: string) => {...};
  const setSplitType = (type: SplitType) => {...};
  
  // Validation
  const validateSplit = (): boolean => {...};
  const getSplitPayload = (paidById: number) => {
    // Returns formatted splitPercentage/splitAmount arrays for API
  };
  
  return { splitState, addMember, removeMember, updateAmount, updatePercentage, validateSplit, getSplitPayload };
}
```

**Exports**:
- `useSplitCalculator()` hook
- `SplitState` type
- All split logic (including payload construction)

**Tests**: Can mock amounts/percentages and test EQUAL/AMOUNT/PERCENTAGE independently

**Reusable**: CreateExpenseScreen could also use this hook

---

#### New File 3: `hooks/useExpenseData.ts` (150 lines)
**Purpose**: Data fetching & caching

```typescript
export function useExpenseData(expenseId: number, groupId: number) {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Fetch all 3 data sources
  }, [expenseId, groupId]);
  
  return { expense, categories, groupMembers, loading, error };
}
```

**Exports**:
- `useExpenseData()` hook
- All data fetching logic

**Tests**: Can mock API calls

**Reusable**: Any screen that needs expense data

---

#### New File 4: `components/DatePickerModal.tsx` (120 lines)
**Purpose**: Calendar component (currently embedded)

```typescript
interface DatePickerModalProps {
  visible: boolean;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

export function DatePickerModal({ visible, selectedDate, onSelectDate, onClose }: DatePickerModalProps) {
  // SimpleCalendar + Modal wrapper
  return <Modal>...</Modal>;
}
```

**Exports**:
- `DatePickerModal` component
- All calendar logic

**Tests**: Can test date selection independently

**Reusable**: Any form that needs date picking (ExpenseListScreen filter?)

---

#### New File 5: `components/SplitMembersInput.tsx` (140 lines)
**Purpose**: Split configuration UI

```typescript
interface SplitMembersInputProps {
  members: GroupMember[];
  paidById: number | null;
  splitWithIds: number[];
  splitType: SplitType;
  splitAmount: Record<number, string>;
  splitPercentage: Record<number, string>;
  onAddMember: (id: number) => void;
  onRemoveMember: (id: number) => void;
  onUpdateAmount: (id: number, amt: string) => void;
  onUpdatePercentage: (id: number, pct: string) => void;
  onSplitTypeChange: (type: SplitType) => void;
}

export function SplitMembersInput(props: SplitMembersInputProps) {
  // Selected members chip display
  // Member selector buttons
  // Split type selector (EQUAL/AMOUNT/%)
  // Amount/percentage inputs
  return <View>...</View>;
}
```

**Exports**:
- `SplitMembersInput` component

**Tests**: Can test UI state changes independently

**Reusable**: CreateExpenseScreen needs same split UI

---

#### Refactored Main: `EditExpenseScreen.tsx` (250 lines)
**Purpose**: Screen orchestration only

```typescript
export default function EditExpenseScreen({ navigation, route }: EditExpenseScreenProps) {
  const { expenseId, groupId, groupName, groupCurrencyCode } = route.params;
  const { user } = useAuth();
  
  // Fetch data
  const { expense, categories, groupMembers, loading, error } = useExpenseData(expenseId, groupId);
  
  // Form state
  const { formState, updateField, setError, clearErrors } = useExpenseForm(expense);
  
  // Split logic
  const { splitState, addMember, removeMember, updateAmount, updatePercentage, validateSplit, getSplitPayload } 
    = useSplitCalculator(formState.amount);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  
  const handleUpdate = async () => {
    if (!validateForm() || !validateSplit()) return;
    
    const payload = {
      title: formState.title,
      amount: parseFloat(formState.amount),
      categoryId: formState.category,
      paidById: formState.paidById,
      expenseDate: formState.date,
      notes: formState.notes,
      ...getSplitPayload(formState.paidById),
    };
    
    await updateExpense(expenseId, payload);
    navigation.goBack();
  };
  
  // Render: Just orchestrate components
  return <ScrollView>
    <DatePickerModal visible={showDatePicker} onClose={() => setShowDatePicker(false)} ... />
    <SplitMembersInput ... />
    ... (other form fields)
  </ScrollView>;
}
```

---

## File Structure

```
frontend/src/screens/
├── EditExpenseScreen.tsx          (250 lines) - Main component
├── EditExpenseScreen/
│   ├── hooks/
│   │   ├── useExpenseForm.ts      (200 lines)
│   │   ├── useSplitCalculator.ts  (180 lines)
│   │   └── useExpenseData.ts      (150 lines)
│   └── components/
│       ├── DatePickerModal.tsx    (120 lines)
│       └── SplitMembersInput.tsx  (140 lines)
```

---

## Benefits

### Code Quality
✅ **Single Responsibility**: Each file handles one concern
✅ **Testability**: Hooks and components can be tested independently
✅ **Maintainability**: Changes to splits don't affect form validation
✅ **Type Safety**: Exported types for each hook

### Reusability
✅ `useExpenseData()` → Any screen showing expense details
✅ `useSplitCalculator()` → CreateExpenseScreen, ExpenseListScreen filters
✅ `DatePickerModal()` → Other date-picking forms
✅ `SplitMembersInput()` → CreateExpenseScreen split UI

### Performance
✅ Smaller bundle per component
✅ Easier memoization opportunities
✅ Easier lazy loading if needed

### Developer Experience
✅ Easier to find specific logic
✅ Faster navigation (no 1050-line file!)
✅ Better git blame/history (smaller PRs)
✅ Easier onboarding for new developers

---

## Implementation Order

1. **Create `EditExpenseScreen/` folder** and move files
2. **Extract `useExpenseData.ts`** (least dependent)
3. **Extract `useSplitCalculator.ts`** (independent)
4. **Extract `useExpenseForm.ts`** (independent)
5. **Extract `DatePickerModal.tsx`** (copy-paste, standalone)
6. **Extract `SplitMembersInput.tsx`** (uses split props)
7. **Refactor `EditExpenseScreen.tsx`** (consume all hooks)
8. **Update imports** in screen
9. **Test on mobile** (hard reload)
10. **Delete old embedded code**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking existing functionality | Test on mobile after each extract |
| Import path errors | Use absolute paths from `src/` |
| Performance regression | Measure bundle size before/after |
| Missed exports | Create `EditExpenseScreen/index.ts` barrel export |
| Type issues | Use `satisfies` and `as const` where needed |

---

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| Largest file | 1,050 lines | 250 lines |
| Average file | 1,050 lines | ~180 lines |
| Files to maintain | 1 | 7 |
| Testable units | 0 | 5 |
| Reusable hooks | 0 | 3 |

