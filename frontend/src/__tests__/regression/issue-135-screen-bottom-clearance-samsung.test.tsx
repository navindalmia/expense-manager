import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Platform } from 'react-native';
import ScreenContainer, { ANDROID_ZERO_INSET_NAV_CLEARANCE } from '../../components/ScreenContainer';

// Regression #135: on a Samsung phone with 3-button navigation the Create Group Create/Cancel row sat
// under the system buttons (fine on another phone). Android reported a bottom inset of 0 while still
// drawing the buttons over the app. The fix lives in ScreenContainer, the root every screen uses, so
// it holds on every page: with Android + an inset of 0 it reserves a nav-bar-sized spacer.
const insets = vi.hoisted(() => ({ bottom: 0 }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <div data-rn-safe-area-view="true">{children}</div>,
  useSafeAreaInsets: () => ({ top: 0, bottom: insets.bottom, left: 0, right: 0 }),
}));

const spacer = (c: HTMLElement): Element | null => c.querySelector('[testid="screen-bottom-clearance"]');
const setOS = (os: string) => { (Platform as { OS: string }).OS = os; };

describe('ScreenContainer bottom clearance (Samsung nav bar)', () => {
  beforeEach(() => { insets.bottom = 0; setOS('android'); });

  it('should reserve a nav-bar-sized spacer on Android when the reported bottom inset is 0', () => {
    const { container } = render(<ScreenContainer><span>content</span></ScreenContainer>);
    expect(spacer(container)).not.toBeNull();
    expect(ANDROID_ZERO_INSET_NAV_CLEARANCE).toBeGreaterThanOrEqual(48);
  });

  it('should add no extra spacer when Android reports a real bottom inset', () => {
    insets.bottom = 24;
    const { container } = render(<ScreenContainer><span>content</span></ScreenContainer>);
    expect(spacer(container)).toBeNull();
  });

  it('should add no extra spacer on iOS or web even with an inset of 0', () => {
    setOS('ios');
    const { container } = render(<ScreenContainer><span>content</span></ScreenContainer>);
    expect(spacer(container)).toBeNull();
  });
});
