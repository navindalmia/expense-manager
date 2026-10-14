/**
 * Issue #90 regression pack: re-enabling a disabled theme/label (Enable
 * button endpoints) and category auto-match from the title (history majority,
 * then plural-aware keywords). Pins behaviour that shipped with the feat
 * commits so a later refactor cannot silently drop it.
 */

import * as themeService from '../../services/themeService';
import * as labelService from '../../services/labelService';
import * as expenseService from '../../services/expenseService';
import prisma from '../../lib/prisma';
import themeRoutes from '../../routes/themeRoutes';
import labelRoutes from '../../routes/labelRoutes';

type Fn = 'findUnique' | 'findFirst' | 'findMany' | 'update';
const models = prisma as unknown as Record<string, Record<Fn, jest.Mock> | undefined>;
function m(name: string): Record<Fn, jest.Mock> {
  const found = models[name];
  if (!found) throw new Error(`no mock model ${name}`);
  return found;
}

const tx = prisma as unknown as { $transaction: jest.Mock };

function routePaths(router: unknown): string[] {
  const stack = (router as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack;
  return stack.filter((l) => l.route?.methods.patch).map((l) => l.route!.path);
}

beforeEach(() => {
  jest.clearAllMocks();
  tx.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(prisma));
});

describe('Enable endpoints are registered', () => {
  it('should expose PATCH /:id/enable for themes and labels', () => {
    expect(routePaths(themeRoutes)).toContain('/:id/enable');
    expect(routePaths(labelRoutes)).toContain('/:id/enable');
  });
});

describe.each([
  ['theme', themeService.enableTheme],
  ['label', labelService.enableLabel],
] as const)('enable %s', (model, enable) => {
  const disabled = { id: 5, name: 'Trip', userId: 1, isActive: false };

  it('should re-activate an owned disabled row', async () => {
    m(model).findUnique.mockResolvedValue(disabled);
    m(model).findFirst.mockResolvedValue(null);
    m(model).update.mockResolvedValue({ ...disabled, isActive: true });
    await expect(enable(1, 5)).resolves.toMatchObject({ isActive: true });
    expect(m(model).update).toHaveBeenCalledWith({ where: { id: 5 }, data: { isActive: true } });
  });

  it('should 404 when missing and 403 when owned by someone else', async () => {
    m(model).findUnique.mockResolvedValueOnce(null);
    await expect(enable(1, 5)).rejects.toMatchObject({ statusCode: 404 });
    m(model).findUnique.mockResolvedValueOnce({ ...disabled, userId: 2 });
    await expect(enable(1, 5)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('should be idempotent for an already-active row', async () => {
    m(model).findUnique.mockResolvedValue({ ...disabled, isActive: true });
    await enable(1, 5);
    expect(m(model).update).not.toHaveBeenCalled();
  });
});

describe('category auto-match from the title', () => {
  const match = (expenseId: number, categoryId: number) => ({
    expenseId, title: 'Dinner out', amount: 10, categoryId, splitWithIds: [],
  });

  it('should prefer the most-used category in history over the keyword dictionary', async () => {
    m('category').findMany.mockResolvedValue([{ id: 7, code: 'OTHER' }, { id: 8, code: 'ENTERTAINMENT' }]);
    const s = await expenseService.suggestCategoryForTitle(1, 'dinner', [match(1, 8), match(2, 7), match(3, 7)]);
    expect(s).toEqual({ categoryId: 7, code: 'OTHER', source: 'history' });
  });

  it('should match plural keywords when there is no usable history', async () => {
    m('category').findFirst.mockResolvedValue({ id: 2, code: 'FOOD' });
    const s = await expenseService.suggestCategoryForTitle(1, 'dinners', []);
    expect(s).toEqual({ categoryId: 2, code: 'FOOD', source: 'keyword' });
  });
});
