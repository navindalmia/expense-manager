/**
 * Regression test for issue #100: on edge-to-edge Android the window does not
 * resize for the keyboard, so focused inputs/picker sheets were covered.
 * Fix: pad containers by the OVERLAP between keyboard top and container
 * bottom -- 0 when the window already resized (no double counting).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

type Listener = (e?: { endCoordinates: { screenY: number } }) => void;
const listeners: Record<string, Listener> = {};
let kbVisible = false;
let measured = { y: 0, height: 800 };

vi.mock('react-native', async () => {
  const R = await import('react');
  return {
    Platform: { OS: 'android' },
    Keyboard: {
      isVisible: () => kbVisible,
      metrics: () => ({ screenY: 500 }),
      addListener: (name: string, cb: Listener) => {
        listeners[name] = cb;
        return { remove: vi.fn() };
      },
    },
    View: R.forwardRef(({ children, style, onLayout, ...p }: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
          cb(0, measured.y, 360, measured.height),
      }));
      const flat = Object.assign({}, ...[style].flat(5).filter(Boolean));
      return <div data-testid="v" data-pb={flat.paddingBottom} onClick={onLayout} {...p}>{children}</div>;
    }),
  };
});

import { computeKeyboardOverlap, KeyboardInsetView } from '../../hooks/useKeyboardInset';

beforeEach(() => {
  kbVisible = false;
  measured = { y: 0, height: 800 };
});

describe('issue #100: keyboard overlap inset', () => {
  it('should be the overlap when the keyboard covers the container bottom', () => {
    expect(computeKeyboardOverlap(800, 500)).toBe(300);
  });

  it('should be 0 when the window already resized above the keyboard', () => {
    expect(computeKeyboardOverlap(500, 500)).toBe(0);
    expect(computeKeyboardOverlap(480, 500)).toBe(0);
    expect(computeKeyboardOverlap(800, null)).toBe(0);
  });

  it('should pad by the overlap on keyboardDidShow and reset on hide', () => {
    const { getByTestId } = render(<KeyboardInsetView>x</KeyboardInsetView>);
    expect(getByTestId('v').getAttribute('data-pb')).toBe('0');
    kbVisible = true;
    act(() => listeners.keyboardDidShow({ endCoordinates: { screenY: 500 } }));
    expect(getByTestId('v').getAttribute('data-pb')).toBe('300');
    kbVisible = false;
    act(() => listeners.keyboardDidHide());
    expect(getByTestId('v').getAttribute('data-pb')).toBe('0');
  });

  it('should add no padding when the container already ends above the keyboard', () => {
    measured = { y: 0, height: 500 };
    const { getByTestId } = render(<KeyboardInsetView>x</KeyboardInsetView>);
    kbVisible = true;
    act(() => listeners.keyboardDidShow({ endCoordinates: { screenY: 500 } }));
    expect(getByTestId('v').getAttribute('data-pb')).toBe('0');
  });

  it('should recover the inset when the keyboard re-opens after a hide with no show event', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<KeyboardInsetView>x</KeyboardInsetView>);
    kbVisible = true;
    act(() => listeners.keyboardDidShow({ endCoordinates: { screenY: 500 } }));
    act(() => listeners.keyboardDidHide());
    expect(getByTestId('v').getAttribute('data-pb')).toBe('0');
    act(() => { vi.advanceTimersByTime(300); });
    expect(getByTestId('v').getAttribute('data-pb')).toBe('300');
    vi.useRealTimers();
  });
});
