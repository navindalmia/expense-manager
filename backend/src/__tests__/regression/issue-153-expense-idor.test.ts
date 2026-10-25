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
import { accessibleGroupWhere } from '../../services/groupGuards';
import expenseRoutes from '../../routes/expenseRoutes';
import { authMiddleware } from '../../middlewares/authMiddleware';

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

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { group: accessibleGroupWhere(MALLORY) } })
    );
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

  async function errorOf(promise: Promise<unknown>): Promise<AppError> {
    try {
      await promise;
    } catch (e) {
      if (e instanceof AppError) return e;
    }
    throw new Error('expected an AppError');
  }

  const body = (e: AppError): unknown => ({ message: e.message, code: e.code, details: e.details, status: e.statusCode });

  it('should return an identical 404 body for missing, non-member, and non-member-in-inactive-group', async () => {
    const calls: Array<() => Promise<unknown>> = [
      () => expenseService.getExpenseById(10, MALLORY),
      () => expenseService.updateExpense(10, MALLORY, { title: 'x' }),
      () => expenseService.deleteExpense(10, MALLORY),
    ];
    for (const call of calls) {
      (prisma.expense.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const missing = await errorOf(call());
      (prisma.expense.findUnique as jest.Mock).mockResolvedValueOnce({ id: 10, splitWith: [], group });
      const forbidden = await errorOf(call());
      (prisma.expense.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 10, splitWith: [], group: { ...group, isActive: false },
      });
      const inactive = await errorOf(call());
      expect(body(forbidden)).toEqual(body(missing));
      expect(body(inactive)).toEqual(body(missing));
      expect(missing.message).toBe('EXPENSE.NOT_FOUND');
      expect(missing.details).toEqual({ expenseId: 10 });
    }
  });

  it('should keep GROUP.NOT_FOUND for a member of an inactive group', async () => {
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({ id: 10, splitWith: [], group: { ...group, isActive: false } });
    const e = await errorOf(expenseService.getExpenseById(10, ALICE));
    expect(e.code).toBe('GROUP_NOT_FOUND');
  });

  it("should let member B update A's expense with A's unchanged private category", async () => {
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({
      id: 10, categoryId: 5, amount: 10, splitType: 'EQUAL', splitAmount: [], splitPercentage: [], splitWith: [], group,
    });
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: ALICE, isActive: true });
    (prisma.expense.update as jest.Mock).mockResolvedValue({ id: 10 });
    expect(await statusOf(expenseService.updateExpense(10, 2, { categoryId: 5, title: 'edit' }))).toBe('resolved');
  });

  it("should reject changing to someone else's private category on update", async () => {
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({
      id: 10, categoryId: 4, amount: 10, splitType: 'EQUAL', splitAmount: [], splitPercentage: [], splitWith: [], group,
    });
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: ALICE, isActive: true });
    expect(await statusOf(expenseService.updateExpense(10, 2, { categoryId: 5 }))).toBe(404);
  });

  it('should not let an ex-member already on the split block an unrelated edit, but still block new non-members', async () => {
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({
      id: 10, categoryId: 5, amount: 10, splitType: 'EQUAL', splitAmount: [5, 5], splitPercentage: [],
      splitWith: [{ id: ALICE }, { id: 77 }], group,
    });
    (prisma.expense.update as jest.Mock).mockResolvedValue({ id: 10 });
    expect(await statusOf(expenseService.updateExpense(10, ALICE, { splitWithIds: [ALICE, 77] }))).toBe('resolved');
    expect(await statusOf(expenseService.updateExpense(10, ALICE, { splitWithIds: [ALICE, 77, MALLORY] }))).toBe(403);
  });

  it('should use a namespaced i18n key for a rejected split member', async () => {
    const e = await errorOf(expenseService.updateExpense(10, ALICE, { splitWithIds: [MALLORY] }));
    expect(e.message).toBe('EXPENSE.SPLIT_MEMBER_NOT_IN_GROUP');
  });

  it('should refuse createExpense with a non-member split id and not create', async () => {
    const status = await statusOf(
      expenseService.createExpense({
        title: 't', amount: 5, groupId: 1, paidById: ALICE, categoryId: 5, splitWithIds: [MALLORY], expenseDate: '2026-01-01',
      })
    );
    expect(status).toBe(403);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it('should allow a group creator who is not in members to read, update and delete', async () => {
    const g = { ...group, members: [{ id: 2 }] };
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({
      id: 10, categoryId: 5, amount: 10, splitType: 'EQUAL', splitAmount: [], splitPercentage: [], splitWith: [], group: g,
    });
    (prisma.expense.update as jest.Mock).mockResolvedValue({ id: 10 });
    (prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 10 });
    expect(await statusOf(expenseService.getExpenseById(10, ALICE))).toBe('resolved');
    expect(await statusOf(expenseService.updateExpense(10, ALICE, { title: 'x' }))).toBe('resolved');
    expect(await statusOf(expenseService.deleteExpense(10, ALICE))).toBe('resolved');
  });

  it('should let a member update, delete and list group expenses', async () => {
    (prisma.expense.update as jest.Mock).mockResolvedValue({ id: 10 });
    (prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 10 });
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);
    expect(await statusOf(expenseService.updateExpense(10, 2, { title: 'x' }))).toBe('resolved');
    expect(await statusOf(expenseService.deleteExpense(10, 2))).toBe('resolved');
    expect(await statusOf(expenseService.getGroupExpenses(1, 2))).toBe('resolved');
  });

  it('should hide the expense from a removed member with 404', async () => {
    const g = { ...group, members: [{ id: ALICE }] };
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({ id: 10, splitWith: [], group: g });
    expect(await statusOf(expenseService.getExpenseById(10, 2))).toBe(404);
  });

  it('should protect GET / on the expense router with authMiddleware', () => {
    type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> } };
    const layers = (expenseRoutes as unknown as { stack: Layer[] }).stack;
    const root = layers.find((l) => l.route?.path === '/' && l.route.methods.get);
    expect(root?.route?.stack[0]?.handle).toBe(authMiddleware);
  });

  it('should pin accessibleGroupWhere to its literal predicate shape', () => {
    expect(accessibleGroupWhere(7)).toEqual({
      AND: [{ isActive: true }, { OR: [{ createdById: 7 }, { members: { some: { id: 7 } } }] }],
    });
  });

  it('should allow createExpense to split with a group creator who is not in members', async () => {
    const g = { ...group, members: [{ id: 2 }] };
    (prisma.group.findUnique as jest.Mock).mockResolvedValue(g);
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: null, isActive: true });
    (prisma.expense.create as jest.Mock).mockResolvedValue({ id: 11 });
    const status = await statusOf(
      expenseService.createExpense({
        title: 't', amount: 5, groupId: 1, paidById: 2, requesterId: 2, categoryId: 5, splitWithIds: [ALICE], expenseDate: '2026-01-01',
      })
    );
    expect(status).toBe('resolved');
    expect(prisma.expense.create).toHaveBeenCalled();
  });

  describe('findSimilarExpenses category visibility', () => {
    const candidate = (id: number, categoryId: number, owner: number | null): Record<string, unknown> => ({
      id,
      title: `Lunch ${id}`,
      amount: 5,
      categoryId,
      category: { id: categoryId, userId: owner },
      expenseDate: new Date('2026-01-01'),
      splitWith: [],
    });

    it('should null categoryId for a match backed by a co-member private category but keep global and own', async () => {
      (prisma.group.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
      (prisma.expense.findMany as jest.Mock).mockResolvedValue([
        candidate(1, 7, 2), // co-member's private category
        candidate(2, 8, null), // global
        candidate(3, 9, ALICE), // caller's own
      ]);

      const matches = await expenseService.findSimilarExpenses(ALICE, 'Lunch');
      const byId = new Map(matches.map((m) => [m.expenseId, m.categoryId]));

      expect(byId.get(1)).toBeNull();
      expect(byId.get(2)).toBe(8);
      expect(byId.get(3)).toBe(9);
    });
  });
});
