/**
 * Group Service Tests
 *
 * Covers authorization (isMember/isCreator branches) and core CRUD
 * behavior for groupService.ts -- the app's central authorization
 * surface for group and expense access.
 */

import * as groupService from '../groupService';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');

// jest's automock drops the `currency` delegate from the generated Prisma
// client (unlike `category`/`group`/`expense`/`user`, which automock does
// stub correctly) -- define it manually. See expenseService.test.ts for the
// same workaround.
if (!(prisma as any).currency) {
  (prisma as any).currency = { findUnique: jest.fn() };
}

const CREATOR_ID = 1;
const MEMBER_ID = 2;
const OUTSIDER_ID = 999;

function buildGroup(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: 'Trip to Rome',
    isActive: true,
    createdById: CREATOR_ID,
    members: [{ id: CREATOR_ID }, { id: MEMBER_ID }],
    ...overrides,
  };
}

describe('GroupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGroup', () => {
    it('creates a group with the requesting user connected as a member', async () => {
      (prisma.currency.findUnique as jest.Mock).mockResolvedValue({ id: 10, code: 'GBP' });
      (prisma.group.create as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Trip to Rome',
        createdById: CREATOR_ID,
        members: [{ id: CREATOR_ID, name: 'Alice', email: 'alice@test.com' }],
      });

      const result = await groupService.createGroup({
        name: 'Trip to Rome',
        createdById: CREATOR_ID,
      });

      expect(prisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Trip to Rome',
            createdById: CREATOR_ID,
            members: { connect: { id: CREATOR_ID } },
          }),
        })
      );
      expect(result.id).toBe(1);
    });

    it('throws when the group name is empty', async () => {
      await expect(
        groupService.createGroup({ name: '   ', createdById: CREATOR_ID })
      ).rejects.toThrow('Group name is required');
      expect(prisma.group.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserGroups', () => {
    it("returns only groups the user created or belongs to", async () => {
      (prisma.group.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          createdById: CREATOR_ID,
          members: [{ id: CREATOR_ID }],
          expenses: [],
        },
      ]);

      const result = await groupService.getUserGroups(CREATOR_ID);

      expect(prisma.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { isActive: true },
              {
                OR: [{ createdById: CREATOR_ID }, { members: { some: { id: CREATOR_ID } } }],
              },
            ]),
          }),
        })
      );
      expect(result[0]!.id).toBe(1);
      expect(result[0]!.totalAmount).toBe(0);
    });
  });

  describe('getGroupById', () => {
    it('returns the group when the requesting user is a member', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      const result = await groupService.getGroupById(1, MEMBER_ID);

      expect(result.id).toBe(1);
    });

    it('returns the group when the requesting user is the creator', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      const result = await groupService.getGroupById(1, CREATOR_ID);

      expect(result.id).toBe(1);
    });

    it('throws when the requesting user is neither a member nor the creator', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(groupService.getGroupById(1, OUTSIDER_ID)).rejects.toThrow(
        'Unauthorized: You are not a member of this group'
      );
    });

    it('throws when the group does not exist', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(groupService.getGroupById(999, CREATOR_ID)).rejects.toThrow('Group not found');
    });

    it('throws when the group has been soft-deleted', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(
        buildGroup({ isActive: false })
      );

      await expect(groupService.getGroupById(1, CREATOR_ID)).rejects.toThrow(
        'Group has been deleted'
      );
    });
  });

  describe('addMemberByEmail', () => {
    it('adds an existing user found by email when called by the creator', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 3,
        email: 'new@test.com',
        name: 'New Person',
      });
      (prisma.group.update as jest.Mock).mockResolvedValue({
        ...buildGroup(),
        members: [{ id: CREATOR_ID }, { id: MEMBER_ID }, { id: 3 }],
      });

      const result = await groupService.addMemberByEmail(1, 'new@test.com', CREATOR_ID);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.addedMember.id).toBe(3);
    });

    it('creates a placeholder user when no account exists for that email', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 4,
        email: 'invitee@test.com',
        name: 'invitee',
      });
      (prisma.group.update as jest.Mock).mockResolvedValue(buildGroup());

      const result = await groupService.addMemberByEmail(1, 'invitee@test.com', CREATOR_ID);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'invitee@test.com' }),
        })
      );
      expect(result.addedMember.id).toBe(4);
    });

    it('throws when called by a non-creator member', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(
        groupService.addMemberByEmail(1, 'new@test.com', MEMBER_ID)
      ).rejects.toMatchObject({ statusCode: 403, code: 'GROUP_UNAUTHORIZED' });
      expect(prisma.group.update).not.toHaveBeenCalled();
    });

    it('throws when the user is already a member', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: MEMBER_ID,
        email: 'member@test.com',
        name: 'Existing Member',
      });

      await expect(
        groupService.addMemberByEmail(1, 'member@test.com', CREATOR_ID)
      ).rejects.toMatchObject({ statusCode: 400, code: 'ALREADY_MEMBER' });
    });

    it('throws when the group does not exist', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        groupService.addMemberByEmail(999, 'new@test.com', CREATOR_ID)
      ).rejects.toMatchObject({ statusCode: 404, code: 'GROUP_NOT_FOUND' });
    });
  });

  describe('removeMemberFromGroup', () => {
    it('removes a member when called by the creator', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.group.update as jest.Mock).mockResolvedValue({
        ...buildGroup(),
        members: [{ id: CREATOR_ID, name: 'Alice', email: 'a@test.com' }],
      });

      const result = await groupService.removeMemberFromGroup(1, MEMBER_ID, CREATOR_ID);

      expect(prisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { members: { disconnect: { id: MEMBER_ID } } },
        })
      );
      expect(result.members).toHaveLength(1);
    });

    it('settles the removed member\'s expenses before disconnecting them', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([{ id: 10 }, { id: 11 }]);
      (prisma.group.update as jest.Mock).mockResolvedValue(buildGroup());

      await groupService.removeMemberFromGroup(1, MEMBER_ID, CREATOR_ID);

      expect(prisma.expense.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [10, 11] } },
        data: { isSettled: true },
      });
    });

    it('throws when called by a non-creator member (only the creator may remove members)', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(
        groupService.removeMemberFromGroup(1, CREATOR_ID, MEMBER_ID)
      ).rejects.toMatchObject({ statusCode: 403, code: 'UNAUTHORIZED' });
      expect(prisma.group.update).not.toHaveBeenCalled();
    });

    it('throws when the creator attempts to remove themselves', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(
        groupService.removeMemberFromGroup(1, CREATOR_ID, CREATOR_ID)
      ).rejects.toMatchObject({ statusCode: 400, code: 'CANNOT_REMOVE_SELF' });
    });

    it('throws when the target member is not in the group', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(
        groupService.removeMemberFromGroup(1, OUTSIDER_ID, CREATOR_ID)
      ).rejects.toMatchObject({ statusCode: 404, code: 'MEMBER_NOT_FOUND' });
    });
  });

  describe('updateGroup', () => {
    it('updates the group when called by the creator', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());
      (prisma.group.update as jest.Mock).mockResolvedValue({
        ...buildGroup(),
        name: 'Renamed Trip',
      });

      const result = await groupService.updateGroup(1, CREATOR_ID, { name: 'Renamed Trip' });

      expect(result.name).toBe('Renamed Trip');
    });

    it('throws when called by a non-creator member', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(
        groupService.updateGroup(1, MEMBER_ID, { name: 'Renamed Trip' })
      ).rejects.toMatchObject({ statusCode: 403, code: 'GROUP_UNAUTHORIZED' });
      expect(prisma.group.update).not.toHaveBeenCalled();
    });

    it('throws when the new name is empty', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(
        groupService.updateGroup(1, CREATOR_ID, { name: '   ' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_NAME' });
    });
  });

  describe('deactivateGroup', () => {
    it('deactivates the group when called by the creator', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());
      (prisma.group.update as jest.Mock).mockResolvedValue(buildGroup({ isActive: false }));

      const result = await groupService.deactivateGroup(1, CREATOR_ID);

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('throws when called by a non-creator member', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(groupService.deactivateGroup(1, MEMBER_ID)).rejects.toThrow(
        'Unauthorized: Only group creator can delete group'
      );
      expect(prisma.group.update).not.toHaveBeenCalled();
    });
  });

  describe('getGroupStats', () => {
    it('returns stats for a member', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([
        { amount: 50, paidById: CREATOR_ID, paidBy: { id: CREATOR_ID, name: 'Alice' } },
      ]);

      const result = await groupService.getGroupStats(1, MEMBER_ID);

      expect(result.totalAmount).toBe(50);
      expect(result.totalExpenses).toBe(1);
    });

    it('throws for a non-member, non-creator', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(groupService.getGroupStats(1, OUTSIDER_ID)).rejects.toThrow(
        'Failed to fetch group statistics'
      );
    });
  });

  describe('getGroupExpenses', () => {
    it('returns expenses scoped to the group for a member', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([{ id: 1, groupId: 1 }]);

      const result = await groupService.getGroupExpenses(1, MEMBER_ID);

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ groupId: 1 }) })
      );
      expect(result).toHaveLength(1);
    });

    it('throws for a non-member, non-creator', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(buildGroup());

      await expect(
        groupService.getGroupExpenses(1, OUTSIDER_ID)
      ).rejects.toMatchObject({ statusCode: 403, code: 'GROUP_UNAUTHORIZED' });
    });

    it('throws when the group does not exist', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        groupService.getGroupExpenses(999, CREATOR_ID)
      ).rejects.toMatchObject({ statusCode: 404, code: 'GROUP_NOT_FOUND' });
    });
  });
});
