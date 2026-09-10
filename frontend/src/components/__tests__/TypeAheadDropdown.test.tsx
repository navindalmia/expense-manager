/**
 * TypeAheadDropdown Tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypeAheadDropdown, { TypeAheadItem } from '../TypeAheadDropdown';

const baseItems: TypeAheadItem[] = [
  { id: 1, name: 'Food' },
  { id: 2, name: 'Travel' },
];

// RN's TextInput mock forwards `testID` verbatim, which React renders on
// the underlying <input>/<button> as a lowercase `testid` attribute (not
// the `data-testid` that @testing-library/react's getByTestId expects),
// so query by that attribute directly instead (same pattern as
// CreateExpenseScreen.test.tsx).
function queryTestId(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[testid="${id}"]`) as HTMLElement | null;
}

function requireTestId(container: HTMLElement, id: string): HTMLElement {
  const el = queryTestId(container, id);
  if (!el) {
    throw new Error(`Unable to find element with testid: ${id}`);
  }
  return el;
}

describe('TypeAheadDropdown', () => {
  const renderDropdown = (overrides: Partial<React.ComponentProps<typeof TypeAheadDropdown>> = {}) => {
    const onSelect = vi.fn();
    const onCreateNew = vi.fn();
    const onClose = vi.fn();

    const result = render(
      <TypeAheadDropdown
        visible
        title="Select Category"
        items={baseItems}
        onSelect={onSelect}
        onCreateNew={onCreateNew}
        onClose={onClose}
        testIDPrefix="cat"
        {...overrides}
      />
    );

    return {
      onSelect,
      onCreateNew,
      onClose,
      getByTestId: (id: string) => requireTestId(result.container, id),
      queryByTestId: (id: string) => queryTestId(result.container, id),
    };
  };

  it('renders "Add new" as the first item, followed by the provided items list', () => {
    renderDropdown();

    const optionTexts = screen.getAllByText(/Add new|Food|Travel/).map((el) => el.textContent);
    expect(optionTexts[0]).toContain('Add new');
    expect(optionTexts).toContain('Food');
    expect(optionTexts).toContain('Travel');
  });

  it('filters the existing-items list as the user types, keeping "Add new" first', async () => {
    const user = userEvent.setup();
    const { getByTestId } = renderDropdown();

    await user.type(getByTestId('cat-filter-input'), 'Foo');

    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.queryByText('Travel')).toBeNull();
    expect(screen.getByText('+ Add new')).toBeTruthy();
  });

  it('selecting "Add new" reveals a text input; submitting calls onCreateNew then selects the created item', async () => {
    const user = userEvent.setup();
    const created: TypeAheadItem = { id: 3, name: 'Entertainment' };
    const onCreateNew = vi.fn().mockResolvedValue(created);
    const { onSelect, getByTestId } = renderDropdown({ onCreateNew });

    await user.click(getByTestId('cat-add-new-button'));
    await user.type(getByTestId('cat-create-input'), 'Entertainment');
    await user.click(getByTestId('cat-create-submit-button'));

    await waitFor(() => {
      expect(onCreateNew).toHaveBeenCalledWith('Entertainment');
      expect(onSelect).toHaveBeenCalledWith(created);
    });
  });

  it('selecting an existing item calls onSelect with that item id', async () => {
    const user = userEvent.setup();
    const { onSelect, getByTestId } = renderDropdown();

    await user.click(getByTestId('cat-option-1'));

    expect(onSelect).toHaveBeenCalledWith(baseItems[0]);
  });

  it('renders "Add new" as a usable option even when items is empty', () => {
    const { getByTestId } = renderDropdown({ items: [] });

    expect(getByTestId('cat-add-new-button')).toBeTruthy();
  });

  it('canceling out of "Add new" mode returns to the filtered list and calls neither onCreateNew nor onSelect', async () => {
    const user = userEvent.setup();
    const { onCreateNew, onSelect, getByTestId, queryByTestId } = renderDropdown();

    await user.click(getByTestId('cat-add-new-button'));
    await user.type(getByTestId('cat-create-input'), 'Something');
    await user.click(getByTestId('cat-create-back-button'));

    expect(queryByTestId('cat-create-input')).toBeNull();
    expect(getByTestId('cat-add-new-button')).toBeTruthy();
    expect(onCreateNew).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the text input open with the typed name and surfaces the error when onCreateNew fails', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn().mockRejectedValue(new Error('A category with this name already exists'));
    const { onSelect, getByTestId } = renderDropdown({ onCreateNew });

    await user.click(getByTestId('cat-add-new-button'));
    const input = getByTestId('cat-create-input');
    await user.type(input, 'Duplicate');
    await user.click(getByTestId('cat-create-submit-button'));

    await waitFor(() => {
      expect(screen.getByText('A category with this name already exists')).toBeTruthy();
    });
    expect(getByTestId('cat-create-input')).toHaveValue('Duplicate');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows only "Add new" when the filter text matches nothing', async () => {
    const user = userEvent.setup();
    const { getByTestId } = renderDropdown();

    await user.type(getByTestId('cat-filter-input'), 'zzz-no-match');

    expect(screen.getByText('+ Add new')).toBeTruthy();
    expect(screen.queryByText('Food')).toBeNull();
    expect(screen.queryByText('Travel')).toBeNull();
  });
});
