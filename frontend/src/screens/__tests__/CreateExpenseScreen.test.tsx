/**
 * CreateExpenseScreen Tests
 *
 * GitHub issue #6: the category field used to default to null and
 * hard-block saving until the user manually picked a value. This suite
 * verifies the fix: category now defaults to the backend's "Other"
 * category once categories load, and the form is no longer blocked from
 * saving just because the user never touched the category picker.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CreateExpenseScreen from '../CreateExpenseScreen';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockCategories = [
  { id: 1, code: 'FOOD', label: 'Food' },
  { id: 2, code: 'OTHER', label: 'Other' },
];

const mockGroupMembers = [
  { id: 1, name: 'Alice', email: 'alice@test.com' },
  { id: 2, name: 'Bob', email: 'bob@test.com' },
];

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'alice@test.com', name: 'Alice' } }),
}));

vi.mock('../../services/categoryService', () => ({
  getCategories: vi.fn(),
}));

vi.mock('../../api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { getCategories } from '../../services/categoryService';
import { http } from '../../api/http';

function renderScreen() {
  const navigation = { goBack: vi.fn() } as any;
  const route = {
    params: {
      groupId: 1,
      groupName: 'Roommates',
      groupCurrencyCode: 'GBP',
    },
  } as any;
  const result = render(<CreateExpenseScreen navigation={navigation} route={route} />);

  // RN's TextInput mock forwards `testID` verbatim, which React renders on
  // the underlying <input> as a lowercase `testid` attribute (not the
  // `data-testid` that @testing-library/react's getByTestId expects), so
  // query by that attribute directly instead.
  const getByTestId = (id: string): HTMLElement => {
    const el = result.container.querySelector(`[testid="${id}"]`);
    if (!el) {
      throw new Error(`Unable to find element with testid: ${id}`);
    }
    return el as HTMLElement;
  };

  return { navigation, ...result, getByTestId };
}

describe('CreateExpenseScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCategories as any).mockResolvedValue(mockCategories);
    (http.get as any).mockResolvedValue({ data: { data: { members: mockGroupMembers } } });
    (http.post as any).mockResolvedValue({ data: { data: { id: 99 } } });
  });

  it('defaults the category to "Other" once categories load, without the user picking one', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Other')).toBeTruthy();
    });

    // No "Select..." placeholder should remain for the category field.
    expect(screen.queryByText('Select...')).toBeNull();
  });

  it('does not block save with a category error when the user never touched the category picker', async () => {
    const { getByTestId } = renderScreen();

    // Wait for the default category to be applied.
    await waitFor(() => {
      expect(screen.getByText('Other')).toBeTruthy();
    });

    fireEvent.change(getByTestId('expense-title-input'), { target: { value: 'Dinner' } });
    fireEvent.change(getByTestId('expense-amount-input'), { target: { value: '25' } });

    fireEvent.click(screen.getByText('Create Expense'));

    await waitFor(() => {
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText('Please select a category')).toBeNull();

    const payload = (http.post as any).mock.calls[0][1];
    expect(payload.categoryId).toBe(2); // "OTHER" category id from mockCategories
  });
});
