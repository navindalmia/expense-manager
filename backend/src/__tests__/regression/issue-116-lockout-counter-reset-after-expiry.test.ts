/**
 * Issue #116: after a lock expired, failedLoginAttempts stayed at the threshold so a single
 * further wrong password re-locked the account for another full window.
 */
import { Request, Response } from 'express';
import { login } from '../../controllers/authController';
import prisma from '../../lib/prisma';
import { comparePassword } from '../../utils/passwordHelper';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn(), update: jest.fn() } },
}));
jest.mock('../../utils/passwordHelper', () => ({
  ...jest.requireActual('../../utils/passwordHelper'),
  comparePassword: jest.fn(),
}));

const findUnique = prisma.user.findUnique as jest.Mock;
const update = prisma.user.update as jest.Mock;
const compare = comparePassword as jest.Mock;

function buildRes(): Response {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
}
const req = { body: { email: 'a@b.com', password: 'Wrong1234!' } } as unknown as Request;
const user = (over: object): object => ({
  id: 1, email: 'a@b.com', name: 'A', password: 'h', emailVerified: true, isActive: true,
  lockedUntil: null, failedLoginAttempts: 0, ...over,
});

describe('login lockout counter (issue 116)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    compare.mockResolvedValue(false);
    update.mockResolvedValue({});
  });

  it('should restart the counter at 1 and not re-lock when a wrong password follows an expired lock', async () => {
    findUnique.mockResolvedValue(user({ failedLoginAttempts: 5, lockedUntil: new Date(Date.now() - 1000) }));
    const res = buildRes();
    await login(req, res);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedLoginAttempts: 1, lockedUntil: null } })
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should still lock after 5 consecutive failures with no prior lock', async () => {
    findUnique.mockResolvedValue(user({ failedLoginAttempts: 4 }));
    await login(req, buildRes());
    const data = update.mock.calls[0][0].data;
    expect(data.failedLoginAttempts).toBe(5);
    expect(data.lockedUntil).toBeInstanceOf(Date);
  });

  it('should report minutes remaining and not check the password while locked', async () => {
    findUnique.mockResolvedValue(user({ failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 10 * 60000) }));
    const res = buildRes();
    await login(req, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'ACCOUNT_LOCKED', retryAfterMinutes: 10 })
    );
    expect(compare).not.toHaveBeenCalled();
  });
});
