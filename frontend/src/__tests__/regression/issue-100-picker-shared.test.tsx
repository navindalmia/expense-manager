/** Issue #100: category/label/theme pickers all use the shared TypeAheadDropdown, which must pad for the keyboard. */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import TypeAheadDropdown from '../../components/TypeAheadDropdown';

describe('issue #100: shared picker covers category, label and theme', () => {
  it.each(['edit-expense-category', 'edit-expense-label', 'edit-expense-theme'])(
    'should render filter input and Done inside the keyboard-avoiding wrapper for %s',
    (prefix) => {
      const { container } = render(
        <TypeAheadDropdown visible title="t" items={[]} onSelect={vi.fn()} onCreateNew={vi.fn()} onClose={vi.fn()} testIDPrefix={prefix} />
      );
      const wrap = container.querySelector(`[testid="${prefix}-keyboard-avoiding-view"]`);
      expect(wrap?.querySelector(`[testid="${prefix}-filter-input"]`)).not.toBeNull();
      expect(wrap?.querySelector(`[testid="${prefix}-modal-close-button"]`)).not.toBeNull();
    }
  );
});
