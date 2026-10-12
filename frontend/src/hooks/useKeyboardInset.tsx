/**
 * Keyboard inset (issue #100)
 *
 * On edge-to-edge Android builds the window may NOT resize for the IME, so a
 * focused input near the bottom ends up under the keyboard and
 * KeyboardAvoidingView('height') has nothing to shrink. Instead of guessing
 * from the keyboard height, we pad a container by the actual OVERLAP between
 * the keyboard top and the container bottom (both in window coordinates).
 * If the window already resized, the container bottom is above the keyboard
 * and the overlap is 0, so nothing is double counted (Expo Go vs real build).
 * iOS keeps KeyboardAvoidingView and always gets 0 here.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View, ViewProps } from 'react-native';

export function computeKeyboardOverlap(containerBottom: number | null, keyboardTop: number | null): number {
  if (containerBottom === null || keyboardTop === null) return 0;
  return Math.max(0, Math.round(containerBottom - keyboardTop));
}

export function useKeyboardInset(): {
  ref: React.RefObject<View | null>;
  onLayout: () => void;
  inset: number;
} {
  const ref = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const [inset, setInset] = useState(0);

  const remeasure = useCallback((): void => {
    // Keyboard.metrics()/isVisible() are the source of truth: when focus moves
    // between inputs Android can emit hide without a following show event.
    const m = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
    keyboardTop.current = m ? m.screenY : keyboardTop.current;
    if (keyboardTop.current === null) {
      setInset(0);
      return;
    }
    ref.current?.measureInWindow((_x: number, y: number, _w: number, height: number) => {
      // Our own padding is inside the container, so y + height is unaffected.
      setInset(computeKeyboardOverlap(y + height, keyboardTop.current));
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const recheck = (): void => {
      if (!Keyboard.isVisible()) {
        keyboardTop.current = null;
      }
      remeasure();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      remeasure();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setInset(0);
      // If the keyboard re-opens for the next input without a show event, recover.
      timer = setTimeout(recheck, 250);
    });
    return () => {
      show.remove();
      hide.remove();
      if (timer) clearTimeout(timer);
    };
  }, [remeasure]);

  return { ref, onLayout: remeasure, inset };
}

/** View that pads its bottom by the keyboard overlap (Android only). */
export function KeyboardInsetView({ style, children, ...rest }: ViewProps): React.ReactElement {
  const { ref, onLayout, inset } = useKeyboardInset();
  return (
    <View ref={ref} onLayout={onLayout} style={[style, { paddingBottom: inset }]} {...rest}>
      {children}
    </View>
  );
}
