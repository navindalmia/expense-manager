/**
 * Android workaround for the Add Expense Title field (issues #175, #179).
 *
 * - A controlled `selection` committed in the same render as a new `value` is
 *   ignored by Android's native EditText (it applies the text, then resets the
 *   caret). After a suggestion pick the caret is therefore re-applied through
 *   the input ref after the native update, then the `selection` prop is released.
 * - The suggestion dropdown overlays Amount, so a focus landing on Amount right
 *   after suggestions arrive or a pick is handed back to the Title.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { TextInput } from 'react-native';

/** Delay before the second caret re-apply (the first runs on the next animation frame). */
export const CARET_REAPPLY_DELAY_MS = 80;
/** How long the controlled `selection` prop is kept before being released. */
export const SELECTION_RELEASE_MS = 400;
/** Window after suggestions arrive or a pick during which focus on Amount returns to Title. */
export const AMOUNT_FOCUS_LOCK_MS = 800;

export interface TextSelection {
  start: number;
  end: number;
}

export interface TitleCaretAndFocusGuard {
  titleInputRef: RefObject<TextInput | null>;
  titleSelection: TextSelection | undefined;
  onTitleSelectionChange: (selection: TextSelection) => void;
  /** Start the Amount focus lock window (call when suggestions arrive). */
  armFocusLock: () => void;
  /** After a pick: focus the Title, lock Amount focus, and pin the caret at `length`. */
  pinCaretAtEnd: (length: number) => void;
  /** Wire to Amount's onFocus: returns focus to the Title while the lock is active. */
  onAmountFocus: () => void;
}

export function useTitleCaretAndFocusGuard(): TitleCaretAndFocusGuard {
  const titleInputRef = useRef<TextInput>(null);
  const focusLockUntilRef = useRef<number>(0);
  const caretRef = useRef<TextSelection>({ start: 0, end: 0 });
  const frameRef = useRef<number | null>(null);
  const reapplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [titleSelection, setTitleSelection] = useState<TextSelection | undefined>(undefined);

  const clearTimers = useCallback((): void => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (reapplyTimerRef.current !== null) {
      clearTimeout(reapplyTimerRef.current);
      reapplyTimerRef.current = null;
    }
    if (releaseTimerRef.current !== null) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const onTitleSelectionChange = useCallback((selection: TextSelection): void => {
    caretRef.current = selection;
  }, []);

  const armFocusLock = useCallback((): void => {
    focusLockUntilRef.current = Date.now() + AMOUNT_FOCUS_LOCK_MS;
  }, []);

  const pinCaretAtEnd = useCallback((length: number): void => {
    clearTimers();
    setTitleSelection({ start: length, end: length });
    focusLockUntilRef.current = Date.now() + AMOUNT_FOCUS_LOCK_MS;
    titleInputRef.current?.focus();
    caretRef.current = { start: length, end: length };
    const applyCaret = (): void => {
      titleInputRef.current?.focus();
      titleInputRef.current?.setSelection?.(length, length);
      titleInputRef.current?.setNativeProps?.({ selection: { start: length, end: length } });
    };
    frameRef.current = requestAnimationFrame(applyCaret);
    reapplyTimerRef.current = setTimeout(applyCaret, CARET_REAPPLY_DELAY_MS);
    releaseTimerRef.current = setTimeout(() => setTitleSelection(undefined), SELECTION_RELEASE_MS);
  }, [clearTimers]);

  const onAmountFocus = useCallback((): void => {
    if (Date.now() < focusLockUntilRef.current) {
      titleInputRef.current?.focus();
      const { start, end } = caretRef.current;
      titleInputRef.current?.setSelection?.(start, end);
    }
  }, []);

  return { titleInputRef, titleSelection, onTitleSelectionChange, armFocusLock, pinCaretAtEnd, onAmountFocus };
}
