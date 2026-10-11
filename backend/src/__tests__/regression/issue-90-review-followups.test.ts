/**
 * Issue #90 code-review follow-ups: ZodError -> 400, enable id validation,
 * active-only themes on group create/update, bounded autocomplete query,
 * atomic enable (collision check + update in one transaction).
 */

import { ZodError, z } from 'zod';
import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { errorHandler } from '../../middlewares/errorHandler';
import * as groupService from '../../services/groupService';
import * as themeService from '../../services/themeService';
import * as labelService from '../../services/labelService';
import * as expenseService from '../../services/expenseService';
import * as expenseController from '../../controllers/expenseController';
import { enableTheme } from '../../controllers/themeController';
import { enableLabel } from '../../controllers/labelController';

type Fn = 'create' | 'findMany' | 'findFirst' | 'findUnique' | 'update';
type Mocks = Record<Fn, jest.Mock>;
type Models = Record<string, Mocks | undefined>;
const p = prisma as unknown as { $transaction: jest.Mock };
const models = prisma as unknown as Models;
function m(name: string): Mocks {
  const found = models[name];
  if (!found) throw new Error(`no mock model ${name}`);
  return found;
}

function mockRes(): Response {
  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response;
  (res.status as jest.Mock).mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  p.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
});

describe('errorHandler maps ZodError to 400', () => {
  it('should respond 400 VALIDATION_ERROR when a ZodError reaches the handler', () => {
    let zerr: ZodError | undefined;
    try { z.object({ a: z.string() }).parse({}); } catch (e) { zerr = e as ZodError; }
    const res = mockRes();
    errorHandler(zerr, { language: 'en' } as unknown as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock).mock.calls[0][0].code).toBe('VALIDATION_ERROR');
  });
});

describe('enable endpoints validate :id', () => {
  it.each([
    ['theme', enableTheme],
    ['label', enableLabel],
  ])('should call next with a 400 error when the %s id is not numeric', async (_n, handler) => {
    const next = jest.fn();
    await handler({ user: { id: 1 }, params: { id: 'abc' } } as unknown as Request, mockRes(), next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode ?? 400).toBe(400);
    expect(err).toBeTruthy();
    expect(m('theme').findUnique).not.toHaveBeenCalled();
    expect(m('label').findUnique).not.toHaveBeenCalled();
  });
});

describe('group theme must be active when set', () => {
  it('should reject a disabled theme on group create', async () => {
    m('currency').findUnique.mockResolvedValue({ id: 1, code: 'GBP' });
    m('theme').findUnique.mockResolvedValue({ id: 9, userId: 1, isActive: false });
    await expect(
      groupService.createGroup({ name: 'g', createdById: 1, themeId: 9 } as never)
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(m('group').create).not.toHaveBeenCalled();
  });

  it('should reject switching an existing group to a disabled theme', async () => {
    m('group').findUnique.mockResolvedValue({ id: 1, createdById: 1, themeId: 3 });
    m('theme').findUnique.mockResolvedValue({ id: 9, userId: 1, isActive: false });
    await expect(groupService.updateGroup(1, 1, { themeId: 9 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('should allow keeping an unchanged theme that is already disabled', async () => {
    m('group').findUnique.mockResolvedValue({ id: 1, createdById: 1, themeId: 3 });
    m('theme').findUnique.mockResolvedValue({ id: 3, userId: 1, isActive: false });
    m('group').update.mockResolvedValue({ id: 1 });
    await expect(groupService.updateGroup(1, 1, { themeId: 3 })).resolves.toBeDefined();
  });
});

describe('autocomplete candidate query is bounded', () => {
  it('should cap the candidate query with take and a narrow select', async () => {
    m('group').findMany.mockResolvedValue([{ id: 1 }]);
    m('expense').findMany.mockResolvedValue([]);
    await expenseService.findSimilarExpenses(1, 'coffee');
    const args = m('expense').findMany.mock.calls[0][0];
    expect(args.take).toBeGreaterThan(0);
    expect(args.select).toBeDefined();
    expect(args.include).toBeUndefined();
  });

  it('should skip the category lookup for a one-character title', async () => {
    const spy = jest.spyOn(expenseService, 'findSimilarExpenses').mockResolvedValue([]);
    const cat = jest.spyOn(expenseService, 'suggestCategoryForTitle').mockResolvedValue(null);
    const res = mockRes();
    await expenseController.suggestExpenses({ user: { id: 1 }, query: { title: 'a' } } as unknown as Request, res);
    expect(cat).not.toHaveBeenCalled();
    spy.mockRestore();
    cat.mockRestore();
  });
});

describe('enable is atomic', () => {
  const row = { id: 5, name: 'Trip', userId: 1, isActive: false };

  it.each([
    ['theme', () => themeService.enableTheme(1, 5), 'theme'],
    ['label', () => labelService.enableLabel(1, 5), 'label'],
  ])('should run the %s collision check and update inside one transaction', async (_n, call, model) => {
    m(model).findUnique.mockResolvedValue(row);
    m(model).findFirst.mockResolvedValue(null);
    m(model).update.mockResolvedValue({ ...row, isActive: true });
    await call();
    expect(p.$transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['theme', () => themeService.enableTheme(1, 5), 'theme'],
    ['label', () => labelService.enableLabel(1, 5), 'label'],
  ])('should reject with 409 and not update when a %s name collides', async (_n, call, model) => {
    m(model).findUnique.mockResolvedValue(row);
    m(model).findFirst.mockResolvedValue({ id: 6 });
    await expect(call()).rejects.toMatchObject({ statusCode: 409 });
    expect(m(model).update).not.toHaveBeenCalled();
  });
});
