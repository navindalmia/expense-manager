/**
 * Issue #175: behavior of the Title caret/focus guard hook (replaces the earlier
 * source-text regex check). Fake input handle + fake timers prove the caret is
 * re-applied after the native update, the selection prop is released, the Amount
 * focus lock expires, and nothing fires after unmount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { TextInput } from 'react-native';
import {
  useTitleCaretAndFocusGuard,
  CARET_REAPPLY_DELAY_MS,
  SELECTION_RELEASE_MS,
  AMOUNT_FOCUS_LOCK_MS,
} from '../../hooks/useTitleCaretAndFocusGuard';

interface FakeInput {
  focus: ReturnType<typeof vi.fn>;
  setSelection: ReturnType<typeof vi.fn>;
  setNativeProps: ReturnType<typeof vi.fn>;
}

function setup() {
  const hook = renderHook(() => useTitleCaretAndFocusGuard());
  const input: FakeInput = { focus: vi.fn(), setSelection: vi.fn(), setNativeProps: vi.fn() };
  (hook.result.current.titleInputRef as { current: unknown }).current = input as unknown as TextInput;
  return { hook, input };
}

describe('issue #175: title caret and focus guard hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should control the selection prop at the end then release it, re-applying the caret imperatively', () => {
    const { hook, input } = setup();

    act(() => hook.result.current.pinCaretAtEnd(15));
    expect(hook.result.current.titleSelection).toEqual({ start: 15, end: 15 });
    expect(input.focus).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(CARET_REAPPLY_DELAY_MS + 1);
    });
    expect(input.setSelection).toHaveBeenCalledWith(15, 15);
    expect(input.setNativeProps).toHaveBeenCalledWith({ selection: { start: 15, end: 15 } });

    act(() => {
      vi.advanceTimersByTime(SELECTION_RELEASE_MS);
    });
    expect(hook.result.current.titleSelection).toBeUndefined();
  });

  it('should return Amount focus to the Title inside the lock window and not after it expires', () => {
    const { hook, input } = setup();
    act(() => hook.result.current.pinCaretAtEnd(5));
    input.focus.mockClear();

    act(() => hook.result.current.onAmountFocus());
    expect(input.focus).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(AMOUNT_FOCUS_LOCK_MS + 1);
    });
    input.focus.mockClear();
    act(() => hook.result.current.onAmountFocus());
    expect(input.focus).not.toHaveBeenCalled();
  });

  it('should start the lock when suggestions arrive', () => {
    const { hook, input } = setup();
    act(() => hook.result.current.armFocusLock());

    act(() => hook.result.current.onAmountFocus());

    expect(input.focus).toHaveBeenCalledTimes(1);
  });

  it('should not fire any caret timer after unmount', () => {
    const { hook, input } = setup();
    act(() => hook.result.current.pinCaretAtEnd(9));
    input.setSelection.mockClear();
    input.setNativeProps.mockClear();

    hook.unmount();
    act(() => {
      vi.advanceTimersByTime(SELECTION_RELEASE_MS + 100);
    });

    expect(input.setSelection).not.toHaveBeenCalled();
    expect(input.setNativeProps).not.toHaveBeenCalled();
  });

  it('should cancel the previous pick timers when a new pick starts', () => {
    const { hook, input } = setup();
    act(() => hook.result.current.pinCaretAtEnd(3));
    act(() => hook.result.current.pinCaretAtEnd(8));
    input.setSelection.mockClear();

    act(() => {
      vi.advanceTimersByTime(CARET_REAPPLY_DELAY_MS + 1);
    });

    expect(input.setSelection).toHaveBeenCalledWith(8, 8);
    expect(input.setSelection).not.toHaveBeenCalledWith(3, 3);
  });
});
