/**
 * Issue #62 characterization tests: the "rethrow AppError as-is, otherwise
 * wrap in a fixed 500 AppError" policy of groupService. Written against the
 * pre-refactor code and kept unchanged as the guard for the shared helper.
 */

import * as groupService from '../../services/groupService';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import { logger } from '../../utils/logger';

jest.mock('../../lib/prisma');
jest.mock('../../utils/logger');

interface WrapCase {
  name: string;
  call: () => Promise<unknown>;
  message: string;
  code: string;
}

const CASES: WrapCase[] = [
  {
    name: 'addMemberByEmail',
    call: () => groupService.addMemberByEmail(1, 'a@test.com', 1),
    message: 'Failed to add member to group',
    code: 'ADD_MEMBER_ERROR',
  },
  {
    name: 'updateGroup',
    call: () => groupService.updateGroup(1, 1, { name: 'X' }),
    message: 'Failed to update group',
    code: 'UPDATE_GROUP_ERROR',
  },
  {
    name: 'getGroupExpenses',
    call: () => groupService.getGroupExpenses(1, 1),
    message: 'Failed to fetch group expenses',
    code: 'FETCH_EXPENSES_ERROR',
  },
];

describe('groupService error wrapping (issue #62)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.each(CASES)('$name', ({ call, message, code }) => {
    it('should rethrow the same AppError instance untouched when an AppError is thrown', async () => {
      const original = new AppError('ORIGINAL', 418, 'ORIGINAL_CODE', { x: 1 });
      (prisma.group.findUnique as jest.Mock).mockRejectedValue(original);

      await expect(call()).rejects.toBe(original);
    });

    it('should wrap an unknown Error in a 500 AppError with the fallback message and code', async () => {
      (prisma.group.findUnique as jest.Mock).mockRejectedValue(new Error('db down'));

      const err: unknown = await call().catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.message).toBe(message);
      expect(appErr.statusCode).toBe(500);
      expect(appErr.code).toBe(code);
      expect(appErr.details).toBeUndefined();
    });

    it('should wrap a non-Error rejection in the fallback AppError', async () => {
      (prisma.group.findUnique as jest.Mock).mockRejectedValue('string failure');

      const err: unknown = await call().catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.message).toBe(message);
      expect(appErr.statusCode).toBe(500);
      expect(appErr.code).toBe(code);
    });
  });

  describe('removeMemberFromGroup', () => {
    it('should rethrow the same AppError instance untouched when an AppError is thrown', async () => {
      const original = new AppError('ORIGINAL', 418, 'ORIGINAL_CODE');
      (prisma.group.findUnique as jest.Mock).mockRejectedValue(original);

      await expect(groupService.removeMemberFromGroup(1, 2, 1)).rejects.toBe(original);
    });

    it('should wrap an unknown Error as GROUP.MEMBER_REMOVAL_FAILED (500) carrying the original error in details', async () => {
      const cause = new Error('db down');
      (prisma.group.findUnique as jest.Mock).mockRejectedValue(cause);

      const err: unknown = await groupService
        .removeMemberFromGroup(1, 2, 1)
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.message).toBe('GROUP.MEMBER_REMOVAL_FAILED');
      expect(appErr.statusCode).toBe(500);
      expect(appErr.code).toBe('MEMBER_REMOVAL_ERROR');
      expect(appErr.details).toEqual({ error: cause });
    });

    it('should log the original error with context exactly once when a non-AppError is thrown', async () => {
      const cause = new Error('db down');
      (prisma.group.findUnique as jest.Mock).mockRejectedValue(cause);

      await groupService.removeMemberFromGroup(1, 2, 1).catch((e: unknown) => e);

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith('Error removing member from group', cause, {
        groupId: 1,
        memberId: 2,
        requestorId: 1,
      });
    });

    it('should not log when an AppError is thrown', async () => {
      (prisma.group.findUnique as jest.Mock).mockRejectedValue(new AppError('ORIGINAL', 418, 'ORIGINAL_CODE'));

      await groupService.removeMemberFromGroup(1, 2, 1).catch((e: unknown) => e);

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should wrap a non-Error rejection as GROUP.MEMBER_REMOVAL_FAILED (500)', async () => {
      (prisma.group.findUnique as jest.Mock).mockRejectedValue('string failure');

      const err: unknown = await groupService
        .removeMemberFromGroup(1, 2, 1)
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.message).toBe('GROUP.MEMBER_REMOVAL_FAILED');
      expect(appErr.statusCode).toBe(500);
      expect(appErr.code).toBe('MEMBER_REMOVAL_ERROR');
      expect(appErr.details).toEqual({ error: 'string failure' });
    });
  });
});
