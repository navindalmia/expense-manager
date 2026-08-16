/**
 * AuthContext Tests
 *
 * Covers login/logout state transitions and error handling. `http` is
 * mocked globally in src/tests/setup.tsx (axios.create() returns a
 * vi.fn()-backed instance), so we mock the methods on the already-mocked
 * `http` export directly rather than re-mocking the module.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';
import { http } from '../../api/http';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    multiRemove: vi.fn().mockResolvedValue(undefined),
  },
}));

/** Minimal consumer that exposes auth state/actions via the DOM for assertions. */
function AuthProbe() {
  const { user, isAuthenticated, isHydrating, error, login, logout, signup } = useAuth();
  const [signupResult, setSignupResult] = React.useState<string>('');
  return (
    <div>
      <span data-testid="hydrating">{String(isHydrating)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user-email">{user?.email ?? ''}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="signup-result">{signupResult}</span>
      <button onClick={() => login('user@test.com', 'SecurePass123!').catch(() => {})}>
        login
      </button>
      <button onClick={() => logout()}>logout</button>
      <button
        onClick={() =>
          signup('new@test.com', 'SecurePass123!', 'New User')
            .then((r) => setSignupResult(JSON.stringify(r)))
            .catch(() => {})
        }
      >
        signup
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finishes hydrating with no stored session when storage is empty', async () => {
    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('hydrating').textContent).toBe('false');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('stores the token and user, and flips isAuthenticated true, on successful login', async () => {
    (http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: {
          token: 'jwt-token-abc',
          user: { id: 1, email: 'user@test.com', name: 'Test User' },
        },
      },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('hydrating').textContent).toBe('false'));

    await act(async () => {
      await userEvent.click(screen.getByText('login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('user-email').textContent).toBe('user@test.com');
  });

  it('leaves state unauthenticated and sets an error message on invalid credentials', async () => {
    (http.post as ReturnType<typeof vi.fn>).mockRejectedValue({
      message: 'Invalid email or password',
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('hydrating').textContent).toBe('false'));

    await act(async () => {
      await userEvent.click(screen.getByText('login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Invalid email or password');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('clears user/token state on logout', async () => {
    (http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: {
          token: 'jwt-token-abc',
          user: { id: 1, email: 'user@test.com', name: 'Test User' },
        },
      },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('hydrating').textContent).toBe('false'));
    await act(async () => {
      await userEvent.click(screen.getByText('login'));
    });
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('true'));

    await act(async () => {
      await userEvent.click(screen.getByText('logout'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
    expect(screen.getByTestId('user-email').textContent).toBe('');
  });

  it('does not authenticate the user after signup when email verification is required', async () => {
    (http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: {
          token: 'jwt-token-signup',
          user: { id: 2, email: 'new@test.com', name: 'New User' },
          requireEmailVerification: true,
        },
      },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('hydrating').textContent).toBe('false'));

    await act(async () => {
      await userEvent.click(screen.getByText('signup'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('signup-result').textContent).toBe(
        JSON.stringify({ email: 'new@test.com', requireEmailVerification: true })
      );
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('stores the token and authenticates the user after signup when email verification is not required', async () => {
    (http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: {
          token: 'jwt-token-signup',
          user: { id: 2, email: 'new@test.com', name: 'New User' },
          requireEmailVerification: false,
        },
      },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('hydrating').textContent).toBe('false'));

    await act(async () => {
      await userEvent.click(screen.getByText('signup'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('user-email').textContent).toBe('new@test.com');
    expect(screen.getByTestId('signup-result').textContent).toBe(
      JSON.stringify({ email: 'new@test.com', requireEmailVerification: false })
    );
  });
});
