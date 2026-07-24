/**
 * Email Verification Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import { requireEmailVerified } from '../emailVerificationMiddleware';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

describe('requireEmailVerified', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusCode: number;
  let jsonData: any;

  beforeEach(() => {
    jest.clearAllMocks();
    statusCode = 200;
    jsonData = null;

    req = { user: { id: 1 } as any };
    res = {
      status: jest.fn().mockImplementation((code: number) => {
        statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((data) => {
        jsonData = data;
        return res;
      }),
    };
    next = jest.fn();
  });

  it('calls next() for a verified user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      emailVerified: true,
      email: 'user@test.com',
    });

    await requireEmailVerified(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.user!.emailVerified).toBe(true);
  });

  it('returns 403 for an unverified user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      emailVerified: false,
      email: 'user@test.com',
    });

    await requireEmailVerified(req as Request, res as Response, next);

    expect(statusCode).toBe(403);
    expect(jsonData.error).toBe('EMAIL_NOT_VERIFIED');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is not set', async () => {
    req.user = undefined;

    await requireEmailVerified(req as Request, res as Response, next);

    expect(statusCode).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when the user no longer exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await requireEmailVerified(req as Request, res as Response, next);

    expect(statusCode).toBe(404);
    expect(jsonData.error).toBe('USER_NOT_FOUND');
  });

  it('returns 500 and does not call next() on an unexpected database error', async () => {
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB down'));

    await requireEmailVerified(req as Request, res as Response, next);

    expect(statusCode).toBe(500);
    expect(jsonData.error).toBe('SERVER_ERROR');
    expect(next).not.toHaveBeenCalled();
  });
});
