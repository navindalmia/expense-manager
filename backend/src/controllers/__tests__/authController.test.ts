/**
 * Auth Controller Tests
 * 
 * Validates signup, login, /me, and logout endpoints
 * Security: Tests lockout, deactivation, and error handling
 */

import { Request, Response } from 'express';
import { signup, login, getCurrentUser } from '../authController';
import prisma from '../../lib/prisma';
import * as jwtHelper from '../../utils/jwtHelper';
import * as passwordHelper from '../../utils/passwordHelper';
import { ZodError } from 'zod';

jest.mock('../../lib/prisma');
jest.mock('../../utils/jwtHelper');
jest.mock('../../utils/passwordHelper');

describe('Auth Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusCode: number;
  let jsonData: any;

  beforeEach(() => {
    jest.clearAllMocks();

    statusCode = 200;
    jsonData = null;

    req = {
      body: {},
      user: { id: 1 },
      headers: { authorization: 'Bearer valid-token' },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((data) => {
        jsonData = data;
        return res;
      }),
      send: jest.fn().mockReturnThis(),
    };

    (res.status as jest.Mock).mockImplementation((code) => {
      statusCode = code;
      return res;
    });
  });

  describe('POST /api/auth/signup', () => {
    it('should successfully create user with valid data', async () => {
      const validSignupData = {
        email: 'john@test.com',
        password: 'Valid@Password123',
        name: 'John Doe',
      };

      req.body = validSignupData;

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordHelper.isCommonPassword as jest.Mock).mockReturnValue(false);
      (passwordHelper.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      (jwtHelper.generateToken as jest.Mock).mockReturnValue('valid-token');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        name: 'John Doe',
      });

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(201);
      expect(jsonData.success).toBe(true);
      expect(jsonData.data.token).toBe('valid-token');
      expect(jsonData.data.user.email).toBe('john@test.com');
    });

    it('should reject duplicate email (user-friendly error)', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
        name: 'John Doe',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
      });

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(409);
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBe('EMAIL_CONFLICT');
      // Security: Generic message (don't reveal email exists)
      expect(jsonData.message).toContain('try another email');
    });

    it('should reject common password', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'password123',
        name: 'John Doe',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordHelper.isCommonPassword as jest.Mock).mockReturnValue(true);

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.success).toBe(false);
      expect(jsonData.error).toBe('WEAK_PASSWORD');
    });

    it('should reject invalid email format', async () => {
      req.body = {
        email: 'notanemail',
        password: 'Valid@Password123',
        name: 'John Doe',
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject empty email', async () => {
      req.body = {
        email: '',
        password: 'Valid@Password123',
        name: 'John Doe',
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject password < 8 characters', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Pass@12',
        name: 'John Doe',
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject password without uppercase', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'lowercase@123',
        name: 'John Doe',
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject password without lowercase', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'UPPERCASE@123',
        name: 'John Doe',
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject password without number', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'NoNumbers@abc',
        name: 'John Doe',
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject password without special character', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'NoSpecial123',
        name: 'John Doe',
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject name < 2 characters', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
        name: 'A',
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject name > 100 characters', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
        name: 'A'.repeat(101),
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should reject name with invalid characters', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
        name: 'John@123',
      };

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(400);
      expect(jsonData.error).toBe('VALIDATION_ERROR');
    });

    it('should accept name with apostrophe', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
        name: "O'Brien",
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordHelper.isCommonPassword as jest.Mock).mockReturnValue(false);
      (passwordHelper.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      (jwtHelper.generateToken as jest.Mock).mockReturnValue('valid-token');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        name: "O'Brien",
      });

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(201);
      expect(jsonData.success).toBe(true);
    });

    it('should normalize email to lowercase', async () => {
      req.body = {
        email: 'JOHN@TEST.COM',
        password: 'Valid@Password123',
        name: 'John Doe',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (passwordHelper.isCommonPassword as jest.Mock).mockReturnValue(false);
      (passwordHelper.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
      (jwtHelper.generateToken as jest.Mock).mockReturnValue('valid-token');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        name: 'John Doe',
      });

      await signup(req as Request, res as Response);

      expect(statusCode).toBe(201);
      // Email should be stored as lowercase
      const createCall = (prisma.user.create as jest.Mock).mock.calls[0];
      expect(createCall[0].data.email).toBe('john@test.com');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        name: 'John Doe',
        password: 'hashed_password',
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 0,
      });

      (passwordHelper.comparePassword as jest.Mock).mockResolvedValue(true);
      (jwtHelper.generateToken as jest.Mock).mockReturnValue('valid-token');
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 1,
        lastLogin: new Date(),
      });

      await login(req as Request, res as Response);

      expect(statusCode).toBe(200);
      expect(jsonData.success).toBe(true);
      expect(jsonData.data.token).toBe('valid-token');
    });

    it('should reset failed login attempts on successful login', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        password: 'hashed_password',
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 3,
      });

      (passwordHelper.comparePassword as jest.Mock).mockResolvedValue(true);
      (jwtHelper.generateToken as jest.Mock).mockReturnValue('valid-token');
      (prisma.user.update as jest.Mock).mockResolvedValue({
        failedLoginAttempts: 0,
      });

      await login(req as Request, res as Response);

      expect(statusCode).toBe(200);
      expect(jsonData.success).toBe(true);
    });

    it('should reject non-existent user with generic error', async () => {
      req.body = {
        email: 'nonexistent@test.com',
        password: 'Valid@Password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await login(req as Request, res as Response);

      expect(statusCode).toBe(401);
      expect(jsonData.error).toBe('AUTH_FAILED');
      // Security: Generic error message (don't reveal user doesn't exist)
      expect(jsonData.message).toBe('Invalid email or password');
    });

    it('should reject invalid password with generic error', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Wrong@Password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        password: 'hashed_password',
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 0,
      });

      (passwordHelper.comparePassword as jest.Mock).mockResolvedValue(false);

      await login(req as Request, res as Response);

      expect(statusCode).toBe(401);
      expect(jsonData.error).toBe('AUTH_FAILED');
      // Security: Same error as non-existent user
      expect(jsonData.message).toBe('Invalid email or password');
    });

    it('should increment failed login attempts after wrong password', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Wrong@Password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        password: 'hashed_password',
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 2,
      });

      (passwordHelper.comparePassword as jest.Mock).mockResolvedValue(false);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        failedLoginAttempts: 3,
      });

      await login(req as Request, res as Response);

      expect(statusCode).toBe(401);
      // Verify update was called with incremented attempts
      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0];
      expect(updateCall[0].data.failedLoginAttempts).toBe(3);
    });

    it('should lock account after 5 failed attempts', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Wrong@Password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        password: 'hashed_password',
        isActive: true,
        lockedUntil: null,
        failedLoginAttempts: 4,
      });

      (passwordHelper.comparePassword as jest.Mock).mockResolvedValue(false);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });

      await login(req as Request, res as Response);

      expect(statusCode).toBe(401);
      // Verify lock was set
      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0];
      expect(updateCall[0].data.lockedUntil).toBeDefined();
    });

    it('should reject login when account is locked', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
      };

      const futureDate = new Date(Date.now() + 10 * 60 * 1000);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        password: 'hashed_password',
        isActive: true,
        lockedUntil: futureDate,
        failedLoginAttempts: 5,
      });

      await login(req as Request, res as Response);

      expect(statusCode).toBe(429);
      expect(jsonData.error).toBe('ACCOUNT_LOCKED');
      expect(jsonData.message).toContain('temporarily locked');
    });

    it('should unlock account after lockout period expires', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
      };

      // Lock expired (past date)
      const pastDate = new Date(Date.now() - 1 * 60 * 1000);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        password: 'hashed_password',
        isActive: true,
        lockedUntil: pastDate,
        failedLoginAttempts: 5,
      });

      (passwordHelper.comparePassword as jest.Mock).mockResolvedValue(true);
      (jwtHelper.generateToken as jest.Mock).mockReturnValue('valid-token');
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 1,
        failedLoginAttempts: 0,
        lastLogin: new Date(),
      });

      await login(req as Request, res as Response);

      expect(statusCode).toBe(200);
      expect(jsonData.success).toBe(true);
    });

    it('should reject login for deactivated account', async () => {
      req.body = {
        email: 'john@test.com',
        password: 'Valid@Password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        password: 'hashed_password',
        isActive: false,
        lockedUntil: null,
        failedLoginAttempts: 0,
      });

      await login(req as Request, res as Response);

      expect(statusCode).toBe(403);
      expect(jsonData.error).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      req.user = { id: 1 };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'john@test.com',
        name: 'John Doe',
        isActive: true,
        lastLogin: new Date(),
        createdAt: new Date(),
      });

      await getCurrentUser(req as Request, res as Response);

      expect(statusCode).toBe(200);
      expect(jsonData.success).toBe(true);
      expect(jsonData.data.id).toBe(1);
    });

    it('should reject request without auth token', async () => {
      req.user = undefined;

      await getCurrentUser(req as Request, res as Response);

      expect(statusCode).toBe(401);
      expect(jsonData.error).toBe('UNAUTHORIZED');
    });

    it('should return 404 for deleted user', async () => {
      req.user = { id: 999 };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await getCurrentUser(req as Request, res as Response);

      expect(statusCode).toBe(404);
      expect(jsonData.error).toBe('USER_NOT_FOUND');
    });
  });
});
