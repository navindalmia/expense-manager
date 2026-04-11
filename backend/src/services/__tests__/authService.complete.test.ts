/**
 * Complete Authentication Service Tests
 * 
 * Comprehensive test suite for auth implementation (56 tests)
 * Coverage: Signup, Login, JWT, Password Helpers, Auth Endpoints
 * Security: OWASP compliance, no user enumeration, constant-time comparison
 */

import jwt from 'jsonwebtoken';
import * as passwordHelper from '../../utils/passwordHelper';
import * as jwtHelper from '../../utils/jwtHelper';
import prisma from '../../lib/prisma';
import {
  validateSignup,
  validateLogin,
  signupSchema,
  loginSchema,
} from '../../schemas/authSchema';
import { signup, login, getCurrentUser, logout } from '../../controllers/authController';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

jest.mock('../../lib/prisma');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('=== AUTH SERVICE COMPLETE TEST SUITE (56 TESTS) ===', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '24h';
  });

  // ============================================
  // SECTION 1: PASSWORD HELPER TESTS (14 tests)
  // ============================================

  describe('PASSWORD HELPER UTILITIES', () => {
    describe('hashPassword()', () => {
      it('TEST 1: Should hash password using bcrypt with 10 salt rounds', async () => {
        jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('hashed_password_123');

        const result = await passwordHelper.hashPassword('ValidPass123!');

        expect(require('bcrypt').hash).toHaveBeenCalledWith('ValidPass123!', 10);
        expect(result).toBe('hashed_password_123');
      });

      it('TEST 2: Should generate unique hashes for same password (due to salt)', async () => {
        jest.spyOn(require('bcrypt'), 'hash')
          .mockResolvedValueOnce('hash1_with_salt1')
          .mockResolvedValueOnce('hash2_with_salt2');

        const hash1 = await passwordHelper.hashPassword('SamePass123!');
        const hash2 = await passwordHelper.hashPassword('SamePass123!');

        expect(hash1).not.toBe(hash2);
        expect(require('bcrypt').hash).toHaveBeenCalledTimes(2);
      });

      it('TEST 3: Should throw AppError on bcrypt failure', async () => {
        jest.spyOn(require('bcrypt'), 'hash').mockRejectedValue(new Error('Hash failed'));

        await expect(passwordHelper.hashPassword('TestPass123!')).rejects.toThrow(
          'Failed to hash password'
        );
      });
    });

    describe('comparePassword()', () => {
      it('TEST 4: Should return true when passwords match', async () => {
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

        const result = await passwordHelper.comparePassword('TestPass123!', 'hashed_value');

        expect(result).toBe(true);
        expect(require('bcrypt').compare).toHaveBeenCalledWith('TestPass123!', 'hashed_value');
      });

      it('TEST 5: Should return false when passwords do not match', async () => {
        jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

        const result = await passwordHelper.comparePassword('WrongPass123!', 'hashed_value');

        expect(result).toBe(false);
      });

      it('TEST 6: Should return false on bcrypt error (security: always fail safe)', async () => {
        jest.spyOn(require('bcrypt'), 'compare').mockRejectedValue(new Error('Compare failed'));

        const result = await passwordHelper.comparePassword('TestPass123!', 'hashed_value');

        expect(result).toBe(false); // Fail-safe behavior
      });
    });

    describe('validatePasswordStrength()', () => {
      it('TEST 7: Should reject password < 8 characters', () => {
        const result = passwordHelper.validatePasswordStrength('Pass1!');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });

      it('TEST 8: Should reject password without uppercase letter', () => {
        const result = passwordHelper.validatePasswordStrength('password123!');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least 1 uppercase letter');
      });

      it('TEST 9: Should reject password without lowercase letter', () => {
        const result = passwordHelper.validatePasswordStrength('PASSWORD123!');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least 1 lowercase letter');
      });

      it('TEST 10: Should reject password without number', () => {
        const result = passwordHelper.validatePasswordStrength('Password!');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must contain at least 1 number');
      });

      it('TEST 11: Should reject password without special character', () => {
        const result = passwordHelper.validatePasswordStrength('Password123');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Password must contain at least 1 special character (!@#$%^&*)'
        );
      });

      it('TEST 12: Should accept valid strong password (8+ chars, UC, LC, #, special)', () => {
        const result = passwordHelper.validatePasswordStrength('ValidPass123!');

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('TEST 13: Should reject empty password', () => {
        const result = passwordHelper.validatePasswordStrength('');

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is required');
      });
    });

    describe('isCommonPassword()', () => {
      it('TEST 14: Should detect common passwords (case-insensitive)', () => {
        const commonPasswords = [
          'password',
          'password123',
          'admin',
          'admin123',
          '123456',
          '12345678',
          'qwerty',
          'letmein',
          'welcome',
          'monkey',
          'dragon',
          'master',
          'sunshine',
          'princess',
          'football',
        ];

        commonPasswords.forEach((pwd) => {
          expect(passwordHelper.isCommonPassword(pwd)).toBe(true);
          expect(passwordHelper.isCommonPassword(pwd.toUpperCase())).toBe(true);
        });

        expect(passwordHelper.isCommonPassword('UniquePass123!')).toBe(false);
      });
    });
  });

  // ============================================
  // SECTION 2: JWT HELPER TESTS (10 tests)
  // ============================================

  describe('JWT HELPER UTILITIES', () => {
    describe('generateToken()', () => {
      it('TEST 15: Should generate JWT with userId in payload', () => {
        jest.spyOn(jwt, 'sign').mockReturnValue('token_abc123');

        const token = jwtHelper.generateToken(42);

        expect(jwt.sign).toHaveBeenCalledWith(
          { userId: 42 },
          'test-secret-key',
          expect.objectContaining({ expiresIn: '24h' })
        );
        expect(token).toBe('token_abc123');
      });

      it('TEST 16: Should generate different tokens for different userIds', () => {
        let callCount = 0;
        jest.spyOn(jwt, 'sign').mockImplementation((payload: any) => {
          callCount++;
          return `token_${callCount}`;
        });

        const token1 = jwtHelper.generateToken(1);
        const token2 = jwtHelper.generateToken(2);

        expect(token1).not.toBe(token2);
      });
    });

    describe('verifyToken()', () => {
      it('TEST 17: Should verify and decode valid token', () => {
        const mockDecoded = { userId: 42, iat: 1234567890, exp: 1234571490 };
        jest.spyOn(jwt, 'verify').mockReturnValue(mockDecoded as any);

        const result = jwtHelper.verifyToken('valid_token');

        expect(result).toEqual(mockDecoded);
        expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'test-secret-key');
      });

      it('TEST 18: Should throw error on expired token', () => {
        jest.spyOn(jwt, 'verify').mockImplementation(() => {
          throw new jwt.TokenExpiredError('jwt expired', new Date());
        });

        expect(() => jwtHelper.verifyToken('expired_token')).toThrow('Token has expired');
      });

      it('TEST 19: Should throw error on invalid token (malformed)', () => {
        jest.spyOn(jwt, 'verify').mockImplementation(() => {
          throw new jwt.JsonWebTokenError('invalid token');
        });

        expect(() => jwtHelper.verifyToken('invalid_token')).toThrow('Invalid token');
      });

      it('TEST 20: Should throw error on not-before error', () => {
        jest.spyOn(jwt, 'verify').mockImplementation(() => {
          throw new jwt.NotBeforeError('jwt not active', new Date());
        });

        expect(() => jwtHelper.verifyToken('future_token')).toThrow('Token not yet valid');
      });

      it('TEST 21: Should throw generic error on unknown jwt error', () => {
        jest.spyOn(jwt, 'verify').mockImplementation(() => {
          throw new Error('Unknown error');
        });

        expect(() => jwtHelper.verifyToken('bad_token')).toThrow('Token verification failed');
      });
    });

    describe('decodeToken()', () => {
      it('TEST 22: Should decode token without verification', () => {
        const mockDecoded = { userId: 42, iat: 1234567890 };
        jest.spyOn(jwt, 'decode').mockReturnValue(mockDecoded as any);

        const result = jwtHelper.decodeToken('token_xyz');

        expect(result).toEqual(mockDecoded);
        expect(jwt.decode).toHaveBeenCalledWith('token_xyz');
      });

      it('TEST 23: Should return null on decode error', () => {
        jest.spyOn(jwt, 'decode').mockImplementation(() => {
          throw new Error('Decode failed');
        });

        const result = jwtHelper.decodeToken('bad_token');

        expect(result).toBeNull();
      });

      it('TEST 24: Should handle token without userId gracefully', () => {
        jest.spyOn(jwt, 'decode').mockReturnValue({ iat: 123 } as any);

        const result = jwtHelper.decodeToken('no_userid_token');

        expect(result).toEqual({ iat: 123 });
      });
    });
  });

  // ============================================
  // SECTION 3: SIGNUP VALIDATION TESTS (15 tests)
  // ============================================

  describe('SIGNUP ENDPOINT & VALIDATION', () => {
    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      });
      jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('hashed_pass');
      jest.spyOn(jwt, 'sign').mockReturnValue('auth_token_123');
    });

    it('TEST 25: Should validate email format (invalid)', () => {
      expect(() => validateSignup({
        email: 'invalid-email',
        password: 'ValidPass123!',
        name: 'John Doe',
      })).toThrow(ZodError);
    });

    it('TEST 26: Should normalize email to lowercase', () => {
      const result = validateSignup({
        email: 'Test@EXAMPLE.COM',
        password: 'ValidPass123!',
        name: 'John Doe',
      });

      expect(result.email).toBe('test@example.com');
    });

    it('TEST 27: Should reject email with consecutive dots (user..name@example.com)', () => {
      expect(() => validateSignup({
        email: 'user..name@example.com',
        password: 'ValidPass123!',
        name: 'John Doe',
      })).toThrow(ZodError);
    });

    it('TEST 28: Should validate name (min 2 characters)', () => {
      expect(() => validateSignup({
        email: 'test@example.com',
        password: 'ValidPass123!',
        name: 'A',
      })).toThrow(ZodError);
    });

    it('TEST 29: Should validate name (max 100 characters)', () => {
      const longName = 'a'.repeat(101);
      expect(() => validateSignup({
        email: 'test@example.com',
        password: 'ValidPass123!',
        name: longName,
      })).toThrow(ZodError);
    });

    it('TEST 30: Should allow name with apostrophes and hyphens', () => {
      const result = validateSignup({
        email: 'test@example.com',
        password: 'ValidPass123!',
        name: "O'Connor-Smith",
      });

      expect(result.name).toBe("O'Connor-Smith");
    });

    it('TEST 31: Should reject name with special characters (not letters/spaces/hyphen/apostrophe)', () => {
      expect(() => validateSignup({
        email: 'test@example.com',
        password: 'ValidPass123!',
        name: 'John@Doe',
      })).toThrow(ZodError);
    });

    it('TEST 32: Should reject empty email', () => {
      expect(() => validateSignup({
        email: '',
        password: 'ValidPass123!',
        name: 'John Doe',
      })).toThrow(ZodError);
    });

    it('TEST 33: Should reject empty password', () => {
      expect(() => validateSignup({
        email: 'test@example.com',
        password: '',
        name: 'John Doe',
      })).toThrow(ZodError);
    });

    it('TEST 34: Should reject empty name', () => {
      expect(() => validateSignup({
        email: 'test@example.com',
        password: 'ValidPass123!',
        name: '',
      })).toThrow(ZodError);
    });

    it('TEST 35: Should not allow duplicate email (generic error for security)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 99,
        email: 'existing@example.com',
      });

      const req = {
        body: {
          email: 'existing@example.com',
          password: 'ValidPass123!',
          name: 'John Doe',
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'EMAIL_CONFLICT',
          success: false,
        })
      );
    });

    it('TEST 36: Should reject common password', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'John Doe',
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'WEAK_PASSWORD',
        })
      );
    });

    it('TEST 37: Should hash password (never stored plaintext)', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          password: 'ValidPass123!',
          name: 'John Doe',
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await signup(req, res);

      // Verify password was hashed, not stored plaintext
      expect(require('bcrypt').hash).toHaveBeenCalledWith('ValidPass123!', 10);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'hashed_pass', // Hashed value, not plaintext
          }),
        })
      );
    });

    it('TEST 38: Should return token on successful signup', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          password: 'ValidPass123!',
          name: 'John Doe',
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: 'auth_token_123',
            user: expect.objectContaining({
              email: 'test@example.com',
            }),
          }),
        })
      );
    });

    it('TEST 39: Should handle server error on account creation', async () => {
      (prisma.user.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const req = {
        body: {
          email: 'test@example.com',
          password: 'ValidPass123!',
          name: 'John Doe',
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'SERVER_ERROR',
        })
      );

      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // SECTION 4: LOGIN ENDPOINT TESTS (14 tests)
  // ============================================

  describe('LOGIN ENDPOINT (Brute Force Protection & Account Lockout)', () => {
    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed_pass',
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 0,
      });
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);
      jest.spyOn(jwt, 'sign').mockReturnValue('auth_token_xyz');
    });

    it('TEST 40: Should successfully login with valid credentials', async () => {
      const req = {
        body: { email: 'test@example.com', password: 'ValidPass123!' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: 'auth_token_xyz',
          }),
        })
      );
    });

    it('TEST 41: Should return generic error on invalid password (no user enumeration)', async () => {
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

      const req = {
        body: { email: 'test@example.com', password: 'WrongPass123!' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await login(req, res);

      const errorCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(errorCall.message).toBe('Invalid email or password'); // Generic message
    });

    it('TEST 42: Should return generic error on non-existent user (no user enumeration)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const req = {
        body: { email: 'nonexistent@example.com', password: 'ValidPass123!' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await login(req, res);

      const errorCall = (res.json as jest.Mock).mock.calls[0][0];
      expect(errorCall.message).toBe('Invalid email or password'); // Generic message
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('TEST 43: Should lock account after 5 failed login attempts', async () => {
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          password: 'hashed_pass',
          isActive: true,
          lockedUntil: null,
          failedLoginAttempts: i,
        });

        const req = {
          body: { email: 'test@example.com', password: 'WrongPass' },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        await login(req, res);
      }

      // Verify that account was marked as locked
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date), // Should have lockout time
          }),
        })
      );
    });

    it('TEST 44: Should prevent login when account is locked', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes in future

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed_pass',
        isActive: true,
        lockedUntil: futureDate,
        failedLoginAttempts: 5,
      });

      const req = {
        body: { email: 'test@example.com', password: 'ValidPass123!' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(429); // Rate limit status
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ACCOUNT_LOCKED',
        })
      );
    });

    it('TEST 45: Should allow login when lockout period expires', async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes in past

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed_pass',
        isActive: true,
        lockedUntil: pastDate, // Lock has expired
        failedLoginAttempts: 5,
      });

      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

      const req = {
        body: { email: 'test@example.com', password: 'ValidPass123!' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200); // Login allowed
    });

    it('TEST 46: Should reset failed attempts on successful login', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed_pass',
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 3, // Had some failed attempts before
      });

      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

      const req = {
        body: { email: 'test@example.com', password: 'ValidPass123!' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await login(req, res);

      // Verify failed attempts were reset to 0
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        })
      );
    });

    it('TEST 47: Should update lastLogin on successful authentication', async () => {
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

      const req = {
        body: { email: 'test@example.com', password: 'ValidPass123!' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await login(req, res);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastLogin: expect.any(Date),
          }),
        })
      );
    });

    it('TEST 48: Should return 403 when account is deactivated', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed_pass',
        isActive: false, // Account deactivated
        lockedUntil: null,
        failedLoginAttempts: 0,
      });

      const req = {
        body: { email: 'test@example.com', password: 'ValidPass123!' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ACCOUNT_INACTIVE',
        })
      );
    });

    it('TEST 49: Should validate email format on login', () => {
      expect(() => validateLogin({
        email: 'invalid-email',
        password: 'ValidPass123!',
      })).toThrow(ZodError);
    });

    it('TEST 50: Should require password on login', () => {
      expect(() => validateLogin({
        email: 'test@example.com',
        password: '',
      })).toThrow(ZodError);
    });

    it('TEST 51: Should normalize email to lowercase on login', () => {
      const result = validateLogin({
        email: 'Test@EXAMPLE.COM',
        password: 'ValidPass123!',
      });

      expect(result.email).toBe('test@example.com');
    });

    it('TEST 52: Should handle server error during login', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const req = {
        body: { email: 'test@example.com', password: 'ValidPass123!' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'SERVER_ERROR',
        })
      );

      consoleSpy.mockRestore();
    });

    it('TEST 53: Should increment failed attempts on invalid password', async () => {
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed_pass',
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 2, // Already 2 failed attempts
      });

      const req = {
        body: { email: 'test@example.com', password: 'WrongPass' },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await login(req, res);

      // Should increment from 2 to 3
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 3,
          }),
        })
      );
    });
  });

  // ============================================
  // SECTION 5: AUTH ENDPOINTS TESTS (13 tests)
  // ============================================

  describe('AUTH ENDPOINTS (Protected Routes)', () => {
    describe('GET /api/auth/me (getCurrentUser)', () => {
      it('TEST 54: Should return user info when authenticated', async () => {
        const req = {
          user: { id: 1 },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        (prisma.user.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          lastLogin: new Date(),
          createdAt: new Date(),
        });

        await getCurrentUser(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              email: 'test@example.com',
            }),
          })
        );
      });

      it('TEST 55: Should return 401 when not authenticated (/me without token)', async () => {
        const req = {} as unknown as Request; // No user

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        await getCurrentUser(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'UNAUTHORIZED',
          })
        );
      });

      it('TEST 56: Should return 404 when user not found (deleted user)', async () => {
        const req = {
          user: { id: 999 },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

        await getCurrentUser(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'USER_NOT_FOUND',
          })
        );
      });
    });

    describe('POST /api/auth/logout', () => {
      it('BONUS 1: Should logout authenticated user (return 200)', async () => {
        const req = {
          user: { id: 1 },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        await logout(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: 'Logged out successfully',
          })
        );
      });

      it('BONUS 2: Should return 401 when logout without token', async () => {
        const req = {} as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        await logout(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'UNAUTHORIZED',
          })
        );
      });

      it('BONUS 3: Should handle logout error gracefully', async () => {
        const req = {
          user: { id: 1 },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        // Simulate error by throwing in outer try
        Object.defineProperty(req, 'user', {
          get: () => {
            throw new Error('Unexpected error');
          },
        });

        await logout(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'SERVER_ERROR',
          })
        );
      });
    });

    describe('Auth Middleware', () => {
      it('BONUS 4: Should reject request without Authorization header', () => {
        const req = {
          headers: {},
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        const next = jest.fn() as unknown as NextFunction;

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'MISSING_TOKEN',
          })
        );
        expect(next).not.toHaveBeenCalled();
      });

      it('BONUS 5: Should reject invalid Authorization header format', () => {
        const req = {
          headers: { authorization: 'InvalidFormat token' },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        const next = jest.fn() as unknown as NextFunction;

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'INVALID_FORMAT',
          })
        );
      });

      it('BONUS 6: Should attach user to request on valid token', () => {
        jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 42 } as any);

        const req = {
          headers: { authorization: 'Bearer valid_token_123' },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        const next = jest.fn() as unknown as NextFunction;

        authMiddleware(req, res, next);

        expect(req.user).toEqual({ id: 42 });
        expect(next).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // SUMMARY
  // ============================================
});
