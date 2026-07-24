/**
 * VerifyEmailScreen Tests
 *
 * Characterizes current behavior of the native verify-email screen, which
 * reads its token from route.params (populated by the native deep link).
 * ROADMAP.md flags a *separate*, confirmed-broken web route
 * (`/verify-email?token=...` falling back to Login) -- that is a routing/
 * linking-config issue upstream of this component, not reproducible at
 * this layer, since this component correctly verifies whatever token
 * route.params supplies to it.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// __DEV__ is injected by the Metro/RN bundler at build time; not present
// under Vitest/jsdom.
(globalThis as any).__DEV__ = false;

vi.mock('react-native', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  KeyboardAvoidingView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TouchableOpacity: ({ children, onPress, disabled, ...props }: any) => (
    <button {...props} onClick={disabled ? undefined : onPress} disabled={disabled}>
      {children}
    </button>
  ),
  TextInput: ({ onChangeText, ...props }: any) => (
    <input {...props} onChange={(e) => onChangeText?.(e.target.value)} />
  ),
  ActivityIndicator: (props: any) => <div {...props}>loading</div>,
  StyleSheet: { create: (styles: any) => styles },
  Platform: { OS: 'ios' },
  Alert: { alert: vi.fn() },
}));

const mockVerifyEmailToken = vi.fn();
const mockResendVerificationEmail = vi.fn();

vi.mock('../../services/emailVerificationService', () => ({
  verifyEmailToken: (...args: any[]) => mockVerifyEmailToken(...args),
  resendVerificationEmail: (...args: any[]) => mockResendVerificationEmail(...args),
}));

import VerifyEmailScreen from '../VerifyEmailScreen';

function renderScreen(token?: string) {
  const navigation = { reset: vi.fn() } as any;
  const route = { params: token ? { token } : undefined } as any;
  render(<VerifyEmailScreen navigation={navigation} route={route} />);
  return { navigation };
}

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and does not call the API when no token is present in route params', async () => {
    renderScreen(undefined);

    await waitFor(() => {
      expect(screen.getByText(/No verification token found/)).toBeTruthy();
    });
    expect(mockVerifyEmailToken).not.toHaveBeenCalled();
  });

  it('verifies the token from route params and shows success', async () => {
    mockVerifyEmailToken.mockResolvedValue({
      success: true,
      data: { user: { id: 1, email: 'user@test.com' } },
    });

    renderScreen('vrf_valid_token');

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeTruthy();
    });
    expect(mockVerifyEmailToken).toHaveBeenCalledWith('vrf_valid_token');
  });

  it('redirects to Login two seconds after a successful verification', async () => {
    mockVerifyEmailToken.mockResolvedValue({
      success: true,
      data: { user: { id: 1, email: 'user@test.com' } },
    });

    const { navigation } = renderScreen('vrf_valid_token');

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeTruthy();
    });
    expect(navigation.reset).not.toHaveBeenCalled();

    // The component's redirect setTimeout is already scheduled against the
    // real clock by this point, so switching to fake timers now can't
    // intercept it (and faking from the start hangs waitFor's own
    // setTimeout-based polling). Waiting out the real 2s delay is the
    // simplest correct option for this specific case.
    await waitFor(
      () => {
        expect(navigation.reset).toHaveBeenCalledWith(
          expect.objectContaining({ routes: [{ name: 'Login' }] })
        );
      },
      { timeout: 3000 }
    );
  }, 10000);

  it('shows an error message when the token is invalid or expired', async () => {
    mockVerifyEmailToken.mockRejectedValue(new Error('Token expired'));

    renderScreen('vrf_expired_token');

    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeTruthy();
    });
  });
});
