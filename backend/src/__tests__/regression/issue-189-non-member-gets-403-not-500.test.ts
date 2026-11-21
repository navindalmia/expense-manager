/**
 * Issue #189: a signed-in user who is not in a group got a 500 from the group
 * detail and stats endpoints because the service threw a raw Error. Both now
 * go through the shared groupGuards helper and answer 403 GROUP_UNAUTHORIZED.
 */

import * as groupService from '../../services/groupService';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');

const GROUP = { id: 5, isActive: true, createdById: 1, members: [{ id: 1 }, { id: 2 }] };
const OUTSIDER = 99;

const CASES: { name: string; call: (userId: number) => Promise<unknown> }[] = [
  { name: 'getGroupById', call: (u) => groupService.getGroupById(5, u) },
  { name: 'getGroupStats', call: (u) => groupService.getGroupStats(5, u) },
];

describe('non-member access to a group (issue #189)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.group.findUnique as jest.Mock).mockResolvedValue(GROUP);
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe.each(CASES)('$name', ({ call }) => {
    it('should reject a non-member with an AppError 403 GROUP_UNAUTHORIZED, not a raw Error', async () => {
      const err: unknown = await call(OUTSIDER).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: 403,
        code: 'GROUP_UNAUTHORIZED',
        messageKey: 'GROUP.NOT_MEMBER',
      });
    });

    it('should still serve the creator and a plain member', async () => {
      await expect(call(1)).resolves.toBeDefined();
      await expect(call(2)).resolves.toBeDefined();
    });
  });
});
