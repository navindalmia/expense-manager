/**
 * Issue #47 regression: a soft-deleted group (isActive = false) must be
 * treated as non-existent by every group-scoped service function. Before the
 * shared assertGroupActive guard, only getGroupById and the group list checked
 * isActive, so a member could still read the stats and expenses of a deleted
 * group, update it, or change its members, while the delete dialog told them
 * they had lost access. Data is retained for support recovery, never served.
 */

import * as groupService from '../../services/groupService';
import * as expenseService from '../../services/expenseService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');
jest.mock('../../utils/logger');

const CREATOR_ID = 1;
const DELETED_GROUP = {
  id: 7,
  createdById: CREATOR_ID,
  isActive: false,
  members: [{ id: CREATOR_ID }],
};

interface DeletedGroupCase {
  name: string;
  call: () => Promise<unknown>;
}

const CASES: DeletedGroupCase[] = [
  { name: 'getGroupById', call: () => groupService.getGroupById(7, CREATOR_ID) },
  { name: 'getGroupStats', call: () => groupService.getGroupStats(7, CREATOR_ID) },
  { name: 'getGroupExpenses', call: () => groupService.getGroupExpenses(7, CREATOR_ID) },
  { name: 'updateGroup', call: () => groupService.updateGroup(7, CREATOR_ID, { name: 'x' }) },
  {
    name: 'addMemberByEmail',
    call: () => groupService.addMemberByEmail(7, 'a@test.com', CREATOR_ID),
  },
  {
    name: 'addMemberToGroup',
    call: () => groupService.addMemberToGroup(7, 'Ann', 'ann@test.com', CREATOR_ID),
  },
  {
    name: 'removeMemberFromGroup',
    call: () => groupService.removeMemberFromGroup(7, 2, CREATOR_ID),
  },
  {
    name: 'deactivateGroup (second delete of the same group)',
    call: () => groupService.deactivateGroup(7, CREATOR_ID),
  },
];

const EXPENSE_ON_DELETED_GROUP = {
  id: 11,
  group: { id: 7, isActive: false, createdById: CREATOR_ID, members: [{ id: CREATOR_ID }] },
  splitWith: [],
};

// Expense routes reach a group's data through expenseService, not groupService,
// so the app's own "expenses of this group" call needs the same guard.
const EXPENSE_CASES: DeletedGroupCase[] = [
  {
    name: 'expenseService.getGroupExpenses (GET /api/expenses/group/:groupId)',
    call: () => expenseService.getGroupExpenses(7, CREATOR_ID),
  },
  {
    name: 'expenseService.createExpense',
    call: () =>
      expenseService.createExpense({
        title: 't',
        amount: 10,
        groupId: 7,
        paidById: CREATOR_ID,
        categoryId: 1,
        expenseDate: '2026-10-01',
      }),
  },
  {
    name: 'expenseService.getExpenseById',
    call: () => expenseService.getExpenseById(11, CREATOR_ID),
  },
  {
    name: 'expenseService.updateExpense',
    call: () => expenseService.updateExpense(11, CREATOR_ID, { title: 'x' }),
  },
  {
    name: 'expenseService.deleteExpense',
    call: () => expenseService.deleteExpense(11, CREATOR_ID),
  },
];

describe('issue #47: soft-deleted group is inaccessible', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.group.findUnique as jest.Mock).mockResolvedValue(DELETED_GROUP);
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue(EXPENSE_ON_DELETED_GROUP);
  });

  it.each([...CASES, ...EXPENSE_CASES])(
    'should reject with 404 GROUP_NOT_FOUND when $name is called on a deleted group',
    async ({ call }) => {
      await expect(call()).rejects.toMatchObject({
        statusCode: 404,
        code: 'GROUP_NOT_FOUND',
        messageKey: 'GROUP.NOT_FOUND',
      });
    }
  );

  it('should not write anything when a deleted group is deleted again', async () => {
    await expect(groupService.deactivateGroup(7, CREATOR_ID)).rejects.toBeDefined();

    expect(prisma.group.update).not.toHaveBeenCalled();
  });

  it('should reject a missing group with the same error as a deleted one', async () => {
    (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(groupService.getGroupStats(7, CREATOR_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'GROUP_NOT_FOUND',
    });
  });
});
