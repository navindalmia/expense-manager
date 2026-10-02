import { describe, it, expect } from 'vitest';
import { mergeUpdatedGroup } from '../../utils/mergeUpdatedGroup';
import type { Group } from '../../services/groupService';

const base: Group = {
  id: 1,
  name: 'Trip',
  currency: { id: 1, code: 'USD', label: 'US Dollar' },
  totalAmount: 120.5,
  userPersonalTotal: 40,
  createdBy: { id: 1, name: 'A', email: 'a@x.com' },
  members: [],
  _count: { expenses: 3, members: 1 },
  isActive: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

// PATCH /groups/:id does not return the computed totals.
const updatePayload: Omit<Group, 'totalAmount' | 'userPersonalTotal'> = {
  id: 1,
  name: 'Trip 2',
  currency: { id: 2, code: 'EUR', label: 'Euro' },
  createdBy: base.createdBy,
  members: [],
  _count: base._count,
  isActive: true,
  createdAt: base.createdAt,
  updatedAt: '2026-02-01',
};

describe('mergeUpdatedGroup', () => {
  it('should apply the new currency and name from the update response', () => {
    const result = mergeUpdatedGroup([base], updatePayload);
    expect(result[0].currency.code).toBe('EUR');
    expect(result[0].name).toBe('Trip 2');
  });

  it('should keep computed totals the update response does not include', () => {
    const result = mergeUpdatedGroup([base], updatePayload);
    expect(result[0].totalAmount).toBe(120.5);
    expect(result[0].userPersonalTotal).toBe(40);
  });

  it('should leave other groups untouched and return a new array', () => {
    const other: Group = { ...base, id: 2 };
    const list = [base, other];
    const result = mergeUpdatedGroup(list, updatePayload);
    expect(result).not.toBe(list);
    expect(result[1]).toBe(other);
  });

  it('should return the list unchanged in content when the updated id is not in the list', () => {
    const list = [base];
    const result = mergeUpdatedGroup(list, { ...updatePayload, id: 99 });
    expect(result).toEqual(list);
    expect(result).not.toBe(list);
  });

  it('should return an empty array when the list is empty', () => {
    expect(mergeUpdatedGroup([], updatePayload)).toEqual([]);
  });

  it('should clear the theme when the update response sets it to null', () => {
    const withTheme: Group = { ...base, theme: { id: 5, name: 'Beach' } as Group['theme'] };
    const result = mergeUpdatedGroup([withTheme], { ...updatePayload, theme: null } as never);
    expect(result[0].theme).toBeNull();
  });

  it('should not mutate the input list or its items', () => {
    const frozen: Group = Object.freeze({ ...base });
    const list: Group[] = Object.freeze([frozen]) as Group[];
    const result = mergeUpdatedGroup(list, updatePayload);
    expect(frozen.currency.code).toBe('USD');
    expect(list[0]).toBe(frozen);
    expect(result[0]).not.toBe(frozen);
  });

  it('should keep existing totals when the update carries explicit undefined totals', () => {
    const result = mergeUpdatedGroup([base], {
      ...updatePayload,
      totalAmount: undefined,
      userPersonalTotal: undefined,
    });
    expect(result[0].totalAmount).toBe(120.5);
    expect(result[0].userPersonalTotal).toBe(40);
  });
});
