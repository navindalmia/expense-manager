/**
 * LoginScreen Tests
 *
 * Mocks useAuth() directly rather than going through a full AuthProvider,
 * since this screen only consumes the context's login/signup/error surface.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginScreen from '../LoginScreen';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mirrors the global react-native mock in src/tests/setup.tsx, adding the
// primitives (Alert, ScrollView, KeyboardAvoidingView, ActivityIndicator)
// this screen additionally needs -- importActual isn't usable here since
// the real react-native package isn't parseable outside its native runtime.
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

const mockLogin = vi.fn();
const mockSignup = vi.fn();
const mockClearError = vi.fn();
let mockError: string | null = null;
let mockIsLoading = false;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: mockSignup,
    isLoading: mockIsLoading,
    error: mockError,
    clearError: mockClearError,
  }),
}));

vi.mock('../../services/emailVerificationService', () => ({
  resendVerificationEmail: vi.fn(),
}));

const navigation = { reset: vi.fn(), navigate: vi.fn() } as any;

function renderLogin() {
  return render(<LoginScreen navigation={navigation} route={{} as any} />);
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockError = null;
    mockIsLoading = false;
  });

  it('calls login with the entered credentials on submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('john@example.com'), 'user@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'SecurePass123!');
    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'SecurePass123!');
    });
  });

  it('blocks submit and does not call login when the email is empty', async () => {
    const RN = await import('react-native');
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'SecurePass123!');
    await userEvent.click(screen.getByText('Login'));

    expect(mockLogin).not.toHaveBeenCalled();
    expect((RN as any).Alert.alert).toHaveBeenCalledWith('Validation', 'Email is required');
  });

  it('displays the error banner text from the auth context', () => {
    mockError = 'Invalid email or password';
    renderLogin();

    expect(screen.getByText('Invalid email or password')).toBeTruthy();
  });

  it('shows a resend-verification button only for an EMAIL_NOT_VERIFIED error', () => {
    mockError = 'Please verify your email address before logging in';
    renderLogin();

    expect(screen.getByText(/Resend Verification Email/)).toBeTruthy();
  });

  it('does not show the resend-verification button for other errors', () => {
    mockError = 'Invalid email or password';
    renderLogin();

    expect(screen.queryByText(/Resend Verification Email/)).toBeNull();
  });

  it('switches to signup mode and calls signup on submit', async () => {
    mockSignup.mockResolvedValue({ email: 'new@test.com' });
    renderLogin();

    await userEvent.click(screen.getByText('Signup'));
    await userEvent.type(screen.getByPlaceholderText('John Doe'), 'New User');
    await userEvent.type(screen.getByPlaceholderText('john@example.com'), 'new@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'SecurePass123!');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('new@test.com', 'SecurePass123!', 'New User');
    });
    expect(navigation.reset).toHaveBeenCalledWith(
      expect.objectContaining({
        routes: [expect.objectContaining({ name: 'CheckEmail', params: { email: 'new@test.com' } })],
      })
    );
  });
});
