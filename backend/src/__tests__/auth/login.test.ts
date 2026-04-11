/**
 * Login Endpoint Tests (14 tests)
 * 
 * Coverage:
 * - Valid login flow
 * - Invalid credentials
 * - User enumeration prevention
 * - Brute force protection
 * - Account lockout logic
 * - Deactivated accounts
 * - Failed attempt tracking
 */

import { Request, Response } from 'express';
import { login } from '../../controllers/authController';
import prisma from '../../lib/prisma';
import * as jwt from '../../utils/jwtHelper';

jest.mock('../../lib/prisma');
jest.mock('../../utils/jwtHelper');

describe('Login Endpoint', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonMock = jest.fn().mockReturnValue(undefined);
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      body: {},
    };

    mockRes = {
      status: statusMock,
    };
  });

  // ========== VALID LOGIN ==========

  test('1. Should successfully login with valid credentials', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    // Mock password comparison to return true
    jest.mock('../../utils/passwordHelper', () => ({
      comparePassword: jest.fn().mockResolvedValue(true),
    }));

    (jwt.generateToken as jest.Mock).mockReturnValue('valid.jwt.token');

    await login(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Login successful',
      })
    );
  });

  // ========== INVALID CREDENTIALS ==========

  test('2. Should reject invalid password', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'WrongPassword123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    await login(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'AUTH_FAILED',
      })
    );
  });

  test('3. Should use generic error for non-existent user (prevent user enumeration)', async () => {
    mockReq.body = {
      email: 'nonexistent@example.com',
      password: 'SomePassword123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await login(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Invalid email or password',
        error: 'AUTH_FAILED',
      })
    );
  });

  // ========== ACCOUNT STATE CHECKS ==========

  test('4. Should reject deactivated/inactive account', async () => {
    mockReq.body = {
      email: 'inactive@example.com',
      password: 'SecurePass123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'inactive@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: false,
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    await login(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'ACCOUNT_INACTIVE',
      })
    );
  });

  // ========== BRUTE FORCE PROTECTION ==========

  test('5. Should reject login from locked account', async () => {
    mockReq.body = {
      email: 'locked@example.com',
      password: 'SecurePass123!',
    };

    const futureTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes in future

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'locked@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: futureTime,
      failedLoginAttempts: 5,
    });

    await login(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(429);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'ACCOUNT_LOCKED',
      })
    );
  });

  test('6. Should increment failed login attempts on wrong password', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'WrongPassword123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    await login(mockReq as Request, mockRes as Response);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        failedLoginAttempts: 1,
        lockedUntil: null,
      },
    });
  });

  test('7. Should lock account after 5 failed attempts', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'WrongPassword123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: null,
      failedLoginAttempts: 4, // This is the 5th attempt
    });

    await login(mockReq as Request, mockRes as Response);

    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0];
    expect(updateCall[0].data.failedLoginAttempts).toBe(5);
    expect(updateCall[0].data.lockedUntil).toBeDefined();
  });

  test('8. Should allow login after lockout period expires', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
    };

    const pastTime = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: pastTime, // Lock expired
      failedLoginAttempts: 5,
    });

    (jwt.generateToken as jest.Mock).mockReturnValue('valid.jwt.token');

    await login(mockReq as Request, mockRes as Response);

    // Should proceed with password check (not locked anymore)
    expect(statusMock).not.toHaveBeenCalledWith(429);
  });

  // ========== SUCCESSFUL LOGIN CLEANUP ==========

  test('9. Should reset failed login attempts on successful login', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: null,
      failedLoginAttempts: 3,
    });

    (jwt.generateToken as jest.Mock).mockReturnValue('valid.jwt.token');

    await login(mockReq as Request, mockRes as Response);

    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0];
    expect(updateCall[0].data.failedLoginAttempts).toBe(0);
    expect(updateCall[0].data.lockedUntil).toBe(null);
  });

  test('10. Should update lastLogin timestamp on successful login', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    (jwt.generateToken as jest.Mock).mockReturnValue('valid.jwt.token');

    const beforeLogin = new Date();
    await login(mockReq as Request, mockRes as Response);
    const afterLogin = new Date();

    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0];
    const lastLogin = updateCall[0].data.lastLogin;

    expect(lastLogin.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    expect(lastLogin.getTime()).toBeLessThanOrEqual(afterLogin.getTime());
  });

  test('11. Should return JWT token on successful login', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    (jwt.generateToken as jest.Mock).mockReturnValue('valid.jwt.token');

    await login(mockReq as Request, mockRes as Response);

    expect(jwt.generateToken).toHaveBeenCalledWith(1);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: 'valid.jwt.token',
          user: expect.objectContaining({
            id: 1,
            email: 'user@example.com',
            name: 'John Doe',
          }),
        }),
      })
    );
  });

  // ========== INPUT VALIDATION ==========

  test('12. Should reject empty email', async () => {
    mockReq.body = {
      email: '',
      password: 'SecurePass123!',
    };

    await login(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'VALIDATION_ERROR',
      })
    );
  });

  test('13. Should reject empty password', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: '',
    };

    await login(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  test('14. Should normalize email to lowercase during login', async () => {
    mockReq.body = {
      email: 'User@EXAMPLE.COM',
      password: 'SecurePass123!',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      password: '$2b$10$hashedpassword',
      isActive: true,
      lockedUntil: null,
      failedLoginAttempts: 0,
    });

    (jwt.generateToken as jest.Mock).mockReturnValue('token');

    await login(mockReq as Request, mockRes as Response);

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: 'user@example.com',
        }),
      })
    );
  });
});
