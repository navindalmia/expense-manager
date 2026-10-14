/**
 * Regression test for issue #88 (placeholder number -- rename once the
 * tracking issue is filed).
 *
 * ROOT CAUSE: the Category/Label/Theme picker (TypeAheadDropdown) is a
 * bottom-sheet Modal. When its search input is focused the on-screen
 * keyboard covered the input because nothing in the modal reacted to the
 * keyboard. Fix: the modal's own content is wrapped in a KeyboardAvoidingView
 * INSIDE the existing SafeAreaView from issue #45 (nesting order
 * Modal > SafeAreaView > KeyboardAvoidingView).
 *
 * As with #45, the assertion targets the modal's OWN wrapper (not a
 * screen-root one), and jsdom cannot simulate a real keyboard, so structure
 * is verified here and real-device behavior via manual verification.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import TypeAheadDropdown from '../../components/TypeAheadDropdown';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }): React.ReactElement => <div>{children}</div>,
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 48,
    left: 0,
    right: 0,
  }),
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }): React.ReactElement => (
    <div data-rn-safe-area-view="true" {...props}>{children}</div>
  ),
}));

function renderPicker(): HTMLElement {
  const { container } = render(
    <TypeAheadDropdown
      visible
      title="Select Label"
      items={[{ id: 1, name: 'Liverpool' }]}
      onSelect={vi.fn()}
      onCreateNew={vi.fn()}
      onClose={vi.fn()}
      testIDPrefix="lbl"
    />
  );
  return container;
}

describe('issue #88: picker search input is not covered by the keyboard', () => {
  it('should wrap the search input in the modal\'s own KeyboardAvoidingView', () => {
    const container = renderPicker();

    const input = container.querySelector('[testid="lbl-filter-input"]');
    const avoiding = input?.closest('[testid="lbl-keyboard-avoiding-view"]');

    expect(input).not.toBeNull();
    expect(avoiding).not.toBeNull();
  });

  it('should keep the issue #45 SafeAreaView as the outer wrapper around the KeyboardAvoidingView', () => {
    const container = renderPicker();

    const avoiding = container.querySelector('[testid="lbl-keyboard-avoiding-view"]');
    const safeArea = avoiding?.closest('[data-rn-safe-area-view]');

    expect(avoiding).not.toBeNull();
    expect(safeArea).not.toBeNull();
    expect(safeArea?.contains(container.querySelector('[testid="lbl-option-1"]'))).toBe(true);
  });
});
