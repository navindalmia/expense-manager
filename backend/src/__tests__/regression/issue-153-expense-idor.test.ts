/**
 * Issue #153 (IDOR / CWE-639): GET /api/expenses returned every user's
 * expenses to any authenticated caller, and some mutation paths accepted
 * references (split members, custom categories) outside the caller's reach.
 *
 * Null-group behaviour: Expense.groupId is NOT NULL in the schema, so there
 * are no group-less expenses; every expense is reachable only through a
 * group the caller created or belongs to (and the group must be active).
 */
import { Request, Response } from 'express';
import * as expenseService from '../../services/expenseService';
import { getExpenses } from '../../controllers/expenseController';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');
jest.mock('../../utils/logger');

const ALICE = 1; // owner of group 1
const MALLORY = 99; // not in any group

const group = {
  id: 1,
  isActive: true,
  createdById: ALICE,
  members: [{ id: ALICE }, { id: 2 }],
};

async function statusOf(promise: Promise<unknown>): Promise<number | string> {
  try {
    await promise;
    return 'resolved';
  } catch (e) {
    return e instanceof AppError ? e.statusCode : 'non-AppError';
  }
}

describe('issue #153: expense access is scoped to the caller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.group.findUnique as jest.Mock).mockResolvedValue(group);
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({
      id: 10,
      amount: 10,
      splitType: 'EQUAL',
      splitAmount: [],
      splitPercentage: [],
      splitWith: [],
      group,
    });
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: ALICE, isActive: true });
    (prisma.currency.findUnique as jest.Mock).mockResolvedValue({ id: 1, code: 'GBP' });
  });

  it('should scope getAllExpenses to groups the caller created or belongs to', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);

    await expenseService.getAllExpenses(MALLORY);

    const args = (prisma.expense.findMany as jest.Mock).mock.calls[0][0] as { where?: unknown };
    expect(JSON.stringify(args.where)).toContain(`"createdById":${MALLORY}`);
    expect(JSON.stringify(args.where)).toContain(`"members":{"some":{"id":${MALLORY}}}`);
    expect(JSON.stringify(args.where)).toContain('"isActive":true');
  });

  it('should pass the authenticated user id from the controller to getAllExpenses', async () => {
    const spy = jest.spyOn(expenseService, 'getAllExpenses').mockResolvedValue([]);
    const res = { json: jest.fn() } as unknown as Response;

    await getExpenses({ user: { id: MALLORY } } as unknown as Request, res);

    expect(spy).toHaveBeenCalledWith(MALLORY);
    spy.mockRestore();
  });

  it('should hide an expense from a non-member with 404 on read', async () => {
    expect(await statusOf(expenseService.getExpenseById(10, MALLORY))).toBe(404);
  });

  it('should hide an expense from a non-member with 404 on update', async () => {
    expect(await statusOf(expenseService.updateExpense(10, MALLORY, { title: 'x' }))).toBe(404);
    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it('should hide an expense from a non-member with 404 on delete', async () => {
    expect(await statusOf(expenseService.deleteExpense(10, MALLORY))).toBe(404);
    expect(prisma.expense.delete).not.toHaveBeenCalled();
  });

  it('should still let a member read their own expense', async () => {
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({ id: 10, group });
    expect(await statusOf(expenseService.getExpenseById(10, 2))).toBe('resolved');
  });

  it('should refuse to add a non-member to the split on update', async () => {
    expect(await statusOf(expenseService.updateExpense(10, ALICE, { splitWithIds: [MALLORY] }))).toBe(403);
    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it("should refuse another user's custom category on update", async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: MALLORY, isActive: true });
    expect(await statusOf(expenseService.updateExpense(10, ALICE, { categoryId: 5 }))).toBe(404);
  });

  it("should refuse another user's custom category on create", async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: MALLORY, isActive: true });
    const status = await statusOf(
      expenseService.createExpense({
        title: 't', amount: 5, groupId: 1, paidById: ALICE, categoryId: 5, expenseDate: '2026-01-01',
      })
    );
    expect(status).toBe(404);
  });

  it('should refuse a non-member creating an expense in a group', async () => {
    const status = await statusOf(
      expenseService.createExpense({
        title: 't', amount: 5, groupId: 1, paidById: ALICE, requesterId: MALLORY, categoryId: 5, expenseDate: '2026-01-01',
      })
    );
    expect(status).toBe(403);
  });

  it("should refuse a non-member listing a group's expenses", async () => {
    expect(await statusOf(expenseService.getGroupExpenses(1, MALLORY))).toBe(403);
  });
});
