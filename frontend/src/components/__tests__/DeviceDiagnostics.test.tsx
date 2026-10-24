import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DeviceDiagnostics, { describeDevice } from '../DeviceDiagnostics';

const text = (c: HTMLElement, id: string): string | null =>
  c.querySelector(`[testid="${id}"]`)?.textContent ?? null;

describe('describeDevice', () => {
  it('should name the maker, model and Android version on Android', () => {
    expect(describeDevice({ Manufacturer: 'samsung', Model: 'SM-S921B', Release: '15', Version: 35 }, 'android'))
      .toBe('samsung SM-S921B, Android 15 (API 35)');
  });

  it('should fall back to the OS name off Android', () => {
    expect(describeDevice(undefined, 'ios')).toBe('ios');
  });
});

describe('DeviceDiagnostics', () => {
  it('should show the insets, window and screen sizes', () => {
    const { container } = render(<DeviceDiagnostics />);
    expect(text(container, 'diag-insets')).toBe('0 / 0');
    expect(text(container, 'diag-window')).toBe('360 x 800');
    expect(text(container, 'diag-screen')).toBe('360 x 800');
    expect(text(container, 'diag-device')).toBe('ios');
  });
});
