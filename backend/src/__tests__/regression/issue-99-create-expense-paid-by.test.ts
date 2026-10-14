/**
 * Issue #99 (placeholder number): creating an expense with "Paid by" set to
 * another member saved the current user as payer, because the controller
 * overwrote the validated body's paidById with the JWT user id.
 */
import { Request, Response } from 'express';
import { createExpense } from '../../controllers/expenseController';
import * as expenseService from '../../services/expenseService';
import prisma from '../../lib/prisma';

jest.mock('../../services/expenseService', () => ({
  ...jest.requireActual('../../services/expenseService'),
  createExpense: jest.fn(),
}));
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    group: { findUnique: jest.fn() },
    currency: { findUnique: jest.fn() },
    expense: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const mockCreate = expenseService.createExpense as jest.Mock;

function buildRes(): Response {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res as unknown as Response;
}

const baseBody = {
  title: 'Dinner',
  amount: 20,
  groupId: 5,
  categoryId: 2,
  expenseDate: '2026-01-01',
};

describe('createExpense controller payer handling (issue 99)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 1 });
  });

  it('should pass the selected payer to the service when body.paidById differs from the user', async () => {
    const req = { user: { id: 1 }, body: { ...baseBody, paidById: 7 } } as unknown as Request;
    await createExpense(req, buildRes());
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ paidById: 7 }));
  });

  it('should keep the current user as the requester for label checks when another payer is chosen', async () => {
    const req = { user: { id: 1 }, body: { ...baseBody, paidById: 7 } } as unknown as Request;
    await createExpense(req, buildRes());
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 1 }));
  });

  it('should default the payer to the current user when paidById is omitted', async () => {
    const req = { user: { id: 1 }, body: { ...baseBody } } as unknown as Request;
    await createExpense(req, buildRes());
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ paidById: 1 }));
  });
});

describe('expenseService.createExpense requester authorization (issue 99)', () => {
  const actual = jest.requireActual('../../services/expenseService') as typeof expenseService;
  const input = {
    title: 'Dinner',
    amount: 20,
    groupId: 5,
    categoryId: 2,
    expenseDate: '2026-01-01',
  };
  const group = { id: 5, createdById: 2, members: [{ id: 2 }, { id: 7 }] };
  const prismaMock = prisma as unknown as {
    group: { findUnique: jest.Mock };
    expense: { create: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.group.findUnique.mockResolvedValue(group);
  });

  it('should reject a non-member requester naming a member as payer, creating nothing', async () => {
    await expect(actual.createExpense({ ...input, paidById: 7, requesterId: 99 })).rejects.toMatchObject({
      statusCode: 403,
      code: 'GROUP_UNAUTHORIZED',
    });
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it('should pass the requester check when a member names another member as payer', async () => {
    await expect(actual.createExpense({ ...input, paidById: 7, requesterId: 2 })).rejects.not.toMatchObject({
      code: 'GROUP_UNAUTHORIZED',
    });
  });
});
