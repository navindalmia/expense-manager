import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyEmailToken, resendVerificationEmail } from '../emailVerificationService';
import { http } from '../../api/http';

/**
 * Email Verification Service Tests
 *
 * Validates verifyEmailToken/resendVerificationEmail against a mocked
 * `http` client (the shared axios instance in src/api/http).
 */

vi.mock('../../api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Email Verification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyEmailToken', () => {
    it('should resolve with the verification response on a valid token', async () => {
      const mockResponse = {
        success: true,
        message: 'Email verified',
        data: {
          user: { id: 1, email: 'user@example.com', name: 'John Doe', emailVerified: true },
        },
      };
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockResponse });

      const result = await verifyEmailToken('valid_token');

      expect(http.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'valid_token' });
      expect(result).toEqual(mockResponse);
    });

    it('should propagate rejection on an invalid/expired token', async () => {
      const error = new Error('Token expired');
      (http.post as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(verifyEmailToken('expired_token')).rejects.toThrow('Token expired');
    });
  });

  describe('resendVerificationEmail', () => {
    it('should resolve with the resend response', async () => {
      const mockResponse = { success: true, message: 'Verification email sent' };
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockResponse });

      const result = await resendVerificationEmail('user@example.com');

      expect(http.post).toHaveBeenCalledWith('/auth/resend-verification', {
        email: 'user@example.com',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should include password in the request body when provided', async () => {
      (http.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, message: 'sent' },
      });

      await resendVerificationEmail('user@example.com', 'SecurePass123!');

      expect(http.post).toHaveBeenCalledWith('/auth/resend-verification', {
        email: 'user@example.com',
        password: 'SecurePass123!',
      });
    });
  });
});
