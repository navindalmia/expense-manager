/**
 * Issue #153 (IDOR / CWE-639), list route: GET /api/expenses returned every
 * user's expenses to any authenticated caller. The list must be scoped to
 * active groups the caller created or belongs to. (Master already scopes the
 * by-id routes; this covers only the list.)
 */
import { Request, Response } from 'express';
import * as expenseService from '../../services/expenseService';
import { getExpenses } from '../../controllers/expenseController';
import prisma from '../../lib/prisma';
import { accessibleGroupWhere } from '../../services/groupGuards';

jest.mock('../../lib/prisma');
jest.mock('../../utils/logger');

const MALLORY = 99; // not in any group

describe('issue #153: GET /api/expenses is scoped to the caller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('should scope getAllExpenses to groups the caller created or belongs to', async () => {
    await expenseService.getAllExpenses(MALLORY);

    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { group: accessibleGroupWhere(MALLORY) } })
    );
  });

  it('should only match active groups the user created or is a member of', () => {
    expect(accessibleGroupWhere(7)).toEqual({
      AND: [{ isActive: true }, { OR: [{ createdById: 7 }, { members: { some: { id: 7 } } }] }],
    });
  });

  it('should pass the authenticated user id from the controller to getAllExpenses', async () => {
    const spy = jest.spyOn(expenseService, 'getAllExpenses').mockResolvedValue([]);
    const res = { json: jest.fn() } as unknown as Response;

    await getExpenses({ user: { id: 42 } } as unknown as Request, res);

    expect(spy).toHaveBeenCalledWith(42);
    spy.mockRestore();
  });
});
