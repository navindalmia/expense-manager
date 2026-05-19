import { describe, it, expect } from 'vitest';
import { verifyEmailToken, resendVerificationEmail } from '../emailVerificationService';

/**
 * Email Verification Service Tests
 * 
 * These tests verify that the email verification service functions
 * are properly exported and callable. Full integration testing should
 * be done with the backend server running.
 */

describe('Email Verification Service', () => {
  describe('API Functions Export', () => {
    it('should export verifyEmailToken function', () => {
      expect(typeof verifyEmailToken).toBe('function');
    });

    it('should export resendVerificationEmail function', () => {
      expect(typeof resendVerificationEmail).toBe('function');
    });

    it('verifyEmailToken should return a Promise', () => {
      const result = verifyEmailToken('test_token');
      expect(result).toBeInstanceOf(Promise);
    });

    it('resendVerificationEmail should return a Promise', () => {
      const result = resendVerificationEmail('test@example.com');
      expect(result).toBeInstanceOf(Promise);
    });
  });
});

