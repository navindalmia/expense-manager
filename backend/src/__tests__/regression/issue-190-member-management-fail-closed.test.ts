/**
 * Issue #190: addMemberToGroup only enforced "creator only" when a requestor
 * id was supplied, so a missing id skipped the check (fail open). It must
 * deny instead.
 */

import * as groupService from '../../services/groupService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

describe('member management authorization (issue #190)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.group.findUnique as jest.Mock).mockResolvedValue({
      id: 5,
      isActive: true,
      createdById: 1,
      members: [{ id: 1 }],
    });
  });

  it('should deny addMemberToGroup with 403 when no requestor id is supplied', async () => {
    const call = groupService.addMemberToGroup(5, 'Ann', 'ann@test.com', undefined as unknown as number);

    await expect(call).rejects.toMatchObject({
      statusCode: 403,
      code: 'GROUP_UNAUTHORIZED',
      messageKey: 'GROUP.ADD_MEMBER_UNAUTHORIZED',
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.group.update).not.toHaveBeenCalled();
  });

  it('should deny addMemberToGroup with 403 for a non-creator member', async () => {
    await expect(groupService.addMemberToGroup(5, 'Ann', 'ann@test.com', 2)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
