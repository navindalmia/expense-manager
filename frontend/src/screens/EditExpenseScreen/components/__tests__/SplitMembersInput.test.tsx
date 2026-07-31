/**
 * SplitMembersInput Tests
 *
 * Issue #4: split amounts didn't update live when typing the Amount field.
 * Root cause: the React.memo comparator on SplitMembersInput compared
 * paidById/splitType/currency/splitWithIds/splitAmount/splitPercentage/
 * members/errors, but never `totalAmount` -- which drives the displayed
 * member share (EQUAL split) and the live percentage->amount preview.
 * Because it was missing from the comparator, re-rendering the parent with
 * only `totalAmount` changed left the memoized component's displayed
 * amounts stale even though the underlying data was correct.
 *
 * Member-edit bug: the member row's add/remove TouchableOpacity used to
 * wrap the amount/percentage TextInput, so tapping into the input to edit
 * a value bubbled up and fired onRemoveMember instead of focusing the
 * field. The fix isolates the toggle target (checkbox + label) from the
 * TextInput.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SplitMembersInput } from '../SplitMembersInput';
import type { GroupMember } from '../../hooks/useExpenseData';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const members: GroupMember[] = [
  { id: 1, name: 'Alice' } as GroupMember,
  { id: 2, name: 'Bob' } as GroupMember,
];

function baseProps(totalAmount: string) {
  return {
    members,
    paidById: 1,
    splitWithIds: [1, 2],
    splitAmount: {},
    splitPercentage: {},
    splitType: 'EQUAL' as const,
    totalAmount,
    currency: 'GBP',
    onAddMember: () => {},
    onRemoveMember: () => {},
    onUpdateAmount: () => {},
    onUpdatePercentage: () => {},
    errors: {},
  };
}

function renderComponent(overrides: Partial<React.ComponentProps<typeof SplitMembersInput>> = {}) {
  const onAddMember = vi.fn();
  const onRemoveMember = vi.fn();
  const onUpdateAmount = vi.fn();
  const onUpdatePercentage = vi.fn();

  render(
    <SplitMembersInput
      members={members}
      paidById={1}
      splitWithIds={[2]}
      splitAmount={{ 2: '10.00' }}
      splitPercentage={{ 2: '50' }}
      splitType="AMOUNT"
      totalAmount="10.00"
      currency="GBP"
      onAddMember={onAddMember}
      onRemoveMember={onRemoveMember}
      onUpdateAmount={onUpdateAmount}
      onUpdatePercentage={onUpdatePercentage}
      {...overrides}
    />
  );

  return { onAddMember, onRemoveMember, onUpdateAmount, onUpdatePercentage };
}

describe('SplitMembersInput', () => {
  describe('live totalAmount updates (issue #4)', () => {
    it('should update displayed EQUAL split amounts when only totalAmount prop changes', () => {
      const { rerender } = render(<SplitMembersInput {...baseProps('100')} />);

      // 100 / 2 members = 50.00 each
      expect(screen.getAllByText('50.00').length).toBeGreaterThan(0);

      rerender(<SplitMembersInput {...baseProps('200')} />);

      // 200 / 2 members = 100.00 each -- must reflect the new totalAmount
      expect(screen.getAllByText('100.00').length).toBeGreaterThan(0);
      expect(screen.queryByText('50.00')).toBeNull();
    });

    it('should update the live percentage-to-amount preview when totalAmount changes', () => {
      const props = {
        ...baseProps('100'),
        splitType: 'PERCENTAGE' as const,
        splitPercentage: { 1: '50', 2: '50' },
      };
      const { rerender } = render(<SplitMembersInput {...props} />);

      // 50% of 100 = 50.00
      expect(screen.getAllByText('50.00').length).toBeGreaterThan(0);

      rerender(<SplitMembersInput {...props} totalAmount="300" />);

      // 50% of 300 = 150.00
      expect(screen.getAllByText('150.00').length).toBeGreaterThan(0);
      expect(screen.queryByText('50.00')).toBeNull();
    });
  });

  describe('member edit/remove touch targets', () => {
    it('does not remove the member when typing into the amount input', () => {
      const { onRemoveMember, onUpdateAmount } = renderComponent();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.click(amountInput);
      fireEvent.change(amountInput, { target: { value: '15.00' } });

      expect(onRemoveMember).not.toHaveBeenCalled();
      expect(onUpdateAmount).toHaveBeenCalledWith(2, '15.00');
    });

    it('does not remove the member when typing into the percentage input', () => {
      const { onRemoveMember, onUpdatePercentage } = renderComponent({
        splitType: 'PERCENTAGE',
      });

      const percentInput = screen.getByPlaceholderText('0');
      fireEvent.click(percentInput);
      fireEvent.change(percentInput, { target: { value: '75' } });

      expect(onRemoveMember).not.toHaveBeenCalled();
      expect(onUpdatePercentage).toHaveBeenCalledWith(2, '75');
    });

    it('removes the member when the checkbox/label toggle is tapped', () => {
      const { onRemoveMember } = renderComponent();

      fireEvent.click(screen.getByText('Bob'));

      expect(onRemoveMember).toHaveBeenCalledWith(2);
    });

    it('adds an unselected member when its checkbox/label toggle is tapped', () => {
      const { onAddMember } = renderComponent({ splitWithIds: [] });

      fireEvent.click(screen.getByText('Bob'));

      expect(onAddMember).toHaveBeenCalledWith(2);
    });
  });
});
