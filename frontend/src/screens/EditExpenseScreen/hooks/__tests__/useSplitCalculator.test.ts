/**
 * useSplitCalculator Tests
 *
 * Regression: addMember/removeMember used to unconditionally recompute an
 * equal PERCENTAGE/AMOUNT split across ALL members whenever the split type
 * was PERCENTAGE or AMOUNT, silently discarding any values the user had
 * manually typed in via updateAmount/updatePercentage for members who
 * weren't the one being added/removed. Per this hook's own module doc,
 * AMOUNT/PERCENTAGE splits should NOT auto-recalculate - only EQUAL should.
 */

import { renderHook, act } from '@testing-library/react';
import { useSplitCalculator } from '../useSplitCalculator';

const members = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Carol' },
];

describe('useSplitCalculator - addMember/removeMember preserve manual edits', () => {
  it('addMember does not overwrite existing members manually-set PERCENTAGE values', () => {
    const { result } = renderHook(() =>
      useSplitCalculator('100', 1, members.slice(0, 2))
    );

    act(() => result.current.setSplitType('PERCENTAGE'));
    act(() => result.current.updatePercentage(1, '70'));
    act(() => result.current.updatePercentage(2, '30'));

    act(() => result.current.addMember(3));

    expect(result.current.splitState.splitPercentage[1]).toBe('70');
    expect(result.current.splitState.splitPercentage[2]).toBe('30');
    // New member gets a default to fill in manually, not a silent equal-split recompute
    expect(result.current.splitState.splitPercentage[3]).toBe('0');
  });

  it('addMember does not overwrite existing members manually-set AMOUNT values', () => {
    const { result } = renderHook(() =>
      useSplitCalculator('100', 1, members.slice(0, 2))
    );

    act(() => result.current.setSplitType('AMOUNT'));
    act(() => result.current.updateAmount(1, '80'));
    act(() => result.current.updateAmount(2, '20'));

    act(() => result.current.addMember(3));

    expect(result.current.splitState.splitAmount[1]).toBe('80');
    expect(result.current.splitState.splitAmount[2]).toBe('20');
    expect(result.current.splitState.splitAmount[3]).toBe('0');
  });

  it('removeMember does not overwrite remaining members manually-set PERCENTAGE values', () => {
    const { result } = renderHook(() =>
      useSplitCalculator('100', 1, members)
    );

    act(() => result.current.setSplitType('PERCENTAGE'));
    act(() => result.current.updatePercentage(1, '50'));
    act(() => result.current.updatePercentage(2, '25'));
    act(() => result.current.updatePercentage(3, '25'));

    act(() => result.current.removeMember(3));

    expect(result.current.splitState.splitPercentage[1]).toBe('50');
    expect(result.current.splitState.splitPercentage[2]).toBe('25');
    expect(result.current.splitState.splitPercentage[3]).toBeUndefined();
  });

  it('removeMember does not overwrite remaining members manually-set AMOUNT values', () => {
    const { result } = renderHook(() =>
      useSplitCalculator('100', 1, members)
    );

    act(() => result.current.setSplitType('AMOUNT'));
    act(() => result.current.updateAmount(1, '50'));
    act(() => result.current.updateAmount(2, '25'));
    act(() => result.current.updateAmount(3, '25'));

    act(() => result.current.removeMember(3));

    expect(result.current.splitState.splitAmount[1]).toBe('50');
    expect(result.current.splitState.splitAmount[2]).toBe('25');
    expect(result.current.splitState.splitAmount[3]).toBeUndefined();
  });

  it('EQUAL split still auto-recalculates on membership change (unaffected by this fix)', () => {
    const { result } = renderHook(() =>
      useSplitCalculator('100', 1, members.slice(0, 2))
    );

    // EQUAL is the default splitType; adding a member should still recompute
    // an exact equal split (this behavior is intentionally untouched).
    act(() => result.current.addMember(3));

    const values = Object.values(result.current.splitState.splitPercentage).map(Number);
    const sum = values.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 2);
    expect(values).toHaveLength(3);
  });
});
