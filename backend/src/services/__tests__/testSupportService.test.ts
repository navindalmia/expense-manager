import prisma from '../../lib/prisma';
import { clearUserByEmail, clearAllE2eTestUsers, getActiveVerificationToken } from '../testSupportService';

const db = prisma as unknown as {
  user: { findUnique: jest.Mock; deleteMany: jest.Mock };
  emailVerificationToken: { findFirst: jest.Mock; deleteMany: jest.Mock };
};

beforeEach(() => {
  db.user.findUnique = jest.fn();
  db.user.deleteMany = jest.fn();
  db.emailVerificationToken.findFirst = jest.fn();
  db.emailVerificationToken.deleteMany = jest.fn();
});

describe('clearUserByEmail', () => {
  it('should return null and delete nothing when the user does not exist', async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await clearUserByEmail('x@example.com')).toBeNull();
    expect(db.user.deleteMany).not.toHaveBeenCalled();
  });

  it('should delete tokens before the user and report the token count', async () => {
    db.user.findUnique.mockResolvedValue({ id: 7 });
    const order: string[] = [];
    db.emailVerificationToken.deleteMany.mockImplementation(async () => {
      order.push('tokens');
      return { count: 2 };
    });
    db.user.deleteMany.mockImplementation(async () => {
      order.push('user');
      return { count: 1 };
    });
    expect(await clearUserByEmail('x@example.com')).toEqual({ tokensDeleted: 2 });
    expect(order).toEqual(['tokens', 'user']);
  });
});

describe('clearAllE2eTestUsers', () => {
  it('should only target e2e test emails and return the count', async () => {
    db.user.deleteMany.mockResolvedValue({ count: 3 });
    expect(await clearAllE2eTestUsers()).toBe(3);
    expect(db.user.deleteMany).toHaveBeenCalledWith({
      where: { email: { contains: 'e2e-test-', endsWith: '@example.com' } },
    });
  });
});

describe('getActiveVerificationToken', () => {
  it('should query only unused, unexpired tokens for the user', async () => {
    db.emailVerificationToken.findFirst.mockResolvedValue(null);
    expect(await getActiveVerificationToken(5)).toBeNull();
    const arg = db.emailVerificationToken.findFirst.mock.calls[0][0];
    expect(arg.where).toMatchObject({ userId: 5, isUsed: false });
  });
});
