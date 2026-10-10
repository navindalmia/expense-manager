/**
 * Issue #90 (Maestro run on a CI API 34 emulator): with edge-to-edge on, the
 * picker sheet vanished behind the keyboard because KeyboardAvoidingView
 * 'height' does not work inside a transparent Modal there. On Android the sheet
 * now pads itself by the keyboard height (minus the bottom inset the
 * SafeAreaView already applies). The Maestro flow picker-keyboard-search-visible
 * is the end-to-end proof; this pins the listener wiring.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Keyboard, Platform } from 'react-native';
import TypeAheadDropdown from '../../components/TypeAheadDropdown';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }): React.ReactElement => <div>{children}</div>,
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({ top: 0, bottom: 48, left: 0, right: 0 }),
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }): React.ReactElement => (
    <div data-rn-safe-area-view="true" {...props}>{children}</div>
  ),
}));

type Handler = (e: { endCoordinates: { height: number } }) => void;

describe('issue 90: picker pads itself by the keyboard height on Android', () => {
  const handlers: Record<string, Handler> = {};
  const originalOS = Platform.OS;
  const remove = vi.fn();

  beforeEach(() => {
    Platform.OS = 'android';
    vi.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: Handler) => {
      handlers[event] = cb;
      return { remove };
    }) as unknown as typeof Keyboard.addListener);
  });
  afterEach(() => {
    Platform.OS = originalOS;
    vi.restoreAllMocks();
  });

  function renderPicker(): HTMLElement {
    return render(
      <TypeAheadDropdown visible title="Select Label" items={[{ id: 1, name: 'Liverpool' }]} onSelect={vi.fn()} onCreateNew={vi.fn()} onClose={vi.fn()} testIDPrefix="lbl" />
    ).container;
  }
  const sheet = (c: HTMLElement) => c.querySelector('[testid="lbl-keyboard-avoiding-view"]') as HTMLElement;

  it('should apply keyboard height minus the bottom inset as padding when the keyboard shows, and clear it on hide', () => {
    const container = renderPicker();
    expect(handlers.keyboardDidShow).toBeTypeOf('function');
    expect(handlers.keyboardDidHide).toBeTypeOf('function');

    act(() => handlers.keyboardDidShow!({ endCoordinates: { height: 800 } }));
    expect(getComputedStyle(sheet(container)).paddingBottom).toBe('752px');

    act(() => handlers.keyboardDidHide!({ endCoordinates: { height: 0 } }));
    expect(getComputedStyle(sheet(container)).paddingBottom).not.toBe('752px');
  });

  it('should remove its keyboard listeners on unmount', () => {
    const { unmount } = render(
      <TypeAheadDropdown visible title="t" items={[]} onSelect={vi.fn()} onCreateNew={vi.fn()} onClose={vi.fn()} testIDPrefix="lbl" />
    );
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
