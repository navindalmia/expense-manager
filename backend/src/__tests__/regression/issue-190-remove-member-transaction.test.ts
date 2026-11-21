/**
 * Issue #190: removing a member settled their expenses and then disconnected
 * them in two separate writes. Both now run in one transaction.
 */

import * as groupService from '../../services/groupService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

type TxCallback = (tx: unknown) => Promise<unknown>;

function buildTx() {
  return {
    expense: { findMany: jest.fn().mockResolvedValue([{ id: 10 }]), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    group: { update: jest.fn().mockResolvedValue({ id: 5, members: [] }) },
  };
}

describe('remove member is atomic (issue #190)', () => {
  beforeEach(() => {
    (prisma.group.findUnique as jest.Mock).mockResolvedValue({
      id: 5,
      isActive: true,
      createdById: 1,
      members: [{ id: 1 }, { id: 2 }],
    });
  });

  it('should run the settle and disconnect writes on the transaction client only', async () => {
    const tx = buildTx();
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: TxCallback) => fn(tx));

    await groupService.removeMemberFromGroup(5, 2, 1);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.expense.updateMany).toHaveBeenCalledWith({ where: { id: { in: [10] } }, data: { isSettled: true } });
    expect(tx.group.update).toHaveBeenCalledTimes(1);
    expect(prisma.expense.updateMany).not.toHaveBeenCalled();
    expect(prisma.group.update).not.toHaveBeenCalled();
  });

  it('should surface a failed disconnect as a 500 AppError so the settle write is rolled back', async () => {
    const tx = buildTx();
    tx.group.update.mockRejectedValue(new Error('disconnect failed'));
    // Mirror Prisma: the callback rejecting rejects $transaction (and rolls back)
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: TxCallback) => fn(tx));

    await expect(groupService.removeMemberFromGroup(5, 2, 1)).rejects.toMatchObject({
      statusCode: 500,
      code: 'MEMBER_REMOVAL_ERROR',
    });
    expect(prisma.expense.updateMany).not.toHaveBeenCalled();
  });
});
