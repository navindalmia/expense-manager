/**
 * Signup Endpoint Tests (15 tests)
 * 
 * Coverage:
 * - Input validation (email, password, name)
 * - Password strength requirements
 * - Email normalization
 * - Duplicate email detection
 * - Common password detection
 * - Edge cases and security
 */

import { Request, Response } from 'express';
import { signup } from '../../controllers/authController';
import prisma from '../../lib/prisma';
import * as jwt from '../../utils/jwtHelper';

jest.mock('../../lib/prisma');
jest.mock('../../utils/jwtHelper');

describe('Signup Endpoint', () => {
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

  // ========== VALID SIGNUP ==========

  test('1. Should successfully create user with valid data', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
      name: 'John Doe',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
    });
    (jwt.generateToken as jest.Mock).mockReturnValue('valid.jwt.token');

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Account created successfully',
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

  // ========== EMAIL VALIDATION ==========

  test('2. Should reject invalid email format', async () => {
    mockReq.body = {
      email: 'invalid-email',
      password: 'SecurePass123!',
      name: 'John Doe',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
      })
    );
  });

  test('3. Should reject empty email', async () => {
    mockReq.body = {
      email: '',
      password: 'SecurePass123!',
      name: 'John Doe',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
      })
    );
  });

  test('4. Should reject duplicate email', async () => {
    mockReq.body = {
      email: 'existing@example.com',
      password: 'SecurePass123!',
      name: 'John Doe',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'existing@example.com',
    });

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'EMAIL_CONFLICT',
      })
    );
  });

  test('5. Should normalize email to lowercase', async () => {
    mockReq.body = {
      email: 'User@EXAMPLE.COM',
      password: 'SecurePass123!',
      name: 'John Doe',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
    });
    (jwt.generateToken as jest.Mock).mockReturnValue('token');

    await signup(mockReq as Request, mockRes as Response);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
  });

  // ========== PASSWORD STRENGTH ==========

  test('6. Should reject password shorter than 8 characters', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'Pass12!',
      name: 'John Doe',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
      })
    );
  });

  test('7. Should reject password without uppercase letter', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'securepass123!',
      name: 'John Doe',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'VALIDATION_ERROR',
      })
    );
  });

  test('8. Should reject password without lowercase letter', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SECUREPASS123!',
      name: 'John Doe',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  test('9. Should reject password without number', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass!',
      name: 'John Doe',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  test('10. Should reject password without special character', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123',
      name: 'John Doe',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  test('11. Should reject common password', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'Password123!',
      name: 'John Doe',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'WEAK_PASSWORD',
      })
    );
  });

  // ========== NAME VALIDATION ==========

  test('12. Should reject empty name', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
      name: '',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  test('13. Should reject name with invalid characters', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
      name: 'John@@@',
    };

    await signup(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  // ========== SECURITY - EDGE CASES ==========

  test('14. Should hash password before storage', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
      name: 'John Doe',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
    });
    (jwt.generateToken as jest.Mock).mockReturnValue('token');

    await signup(mockReq as Request, mockRes as Response);

    // Verify that password was NOT stored in plaintext
    const createCall = (prisma.user.create as jest.Mock).mock.calls[0];
    expect(createCall[0].data.password).not.toBe('SecurePass123!');
  });

  test('15. Should return JWT token on successful signup', async () => {
    mockReq.body = {
      email: 'user@example.com',
      password: 'SecurePass123!',
      name: 'John Doe',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
    });
    (jwt.generateToken as jest.Mock).mockReturnValue('valid.jwt.token');

    await signup(mockReq as Request, mockRes as Response);

    expect(jwt.generateToken).toHaveBeenCalledWith(1);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: 'valid.jwt.token',
        }),
      })
    );
  });
});
