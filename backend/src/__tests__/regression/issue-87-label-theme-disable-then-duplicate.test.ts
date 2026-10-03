/**
 * Issue #87 (placeholder number -- rename once the tracking issue is filed):
 * disabling then re-adding a Label/Theme produced a duplicate row instead of
 * reactivating the disabled one.
 */

import * as labelService from '../../services/labelService';
import * as themeService from '../../services/themeService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');

const USER_ID = 1;

interface Case {
  entity: 'label' | 'theme';
  create: (name: string) => Promise<unknown>;
}

const CASES: Case[] = [
  { entity: 'label', create: (name) => labelService.createLabel(USER_ID, name) },
  { entity: 'theme', create: (name) => themeService.createTheme(USER_ID, name) },
];

interface Delegate {
  findFirst: jest.Mock;
  update: jest.Mock;
  create: jest.Mock;
}

describe.each(CASES)('issue-87: create $entity after disable', ({ entity, create }) => {
  const delegate = (): Delegate => prisma[entity] as unknown as Delegate;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should reactivate the disabled row instead of inserting a duplicate', async () => {
    delegate().findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 7, name: 'food', isActive: false });
    delegate().update.mockResolvedValue({ id: 7, name: 'food', isActive: true });

    const result = await create('Food');

    expect(delegate().update).toHaveBeenCalledWith({ where: { id: 7 }, data: { isActive: true } });
    expect(delegate().create).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 7, name: 'food', isActive: true });
  });

  it('should match case-insensitively', async () => {
    delegate().findFirst.mockResolvedValue(null);
    delegate().create.mockResolvedValue({ id: 1 });

    await create('Food');

    expect(delegate().findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ name: { equals: 'Food', mode: 'insensitive' } }) })
    );
  });

  it('should return the existing active row without inserting or updating', async () => {
    const existing = { id: 3, name: 'Food', isActive: true };
    delegate().findFirst.mockResolvedValueOnce(existing);

    const result = await create('food');

    expect(result).toBe(existing);
    expect(delegate().create).not.toHaveBeenCalled();
    expect(delegate().update).not.toHaveBeenCalled();
  });

  it('should only reactivate rows owned by the caller, never another users', async () => {
    delegate().findFirst.mockResolvedValue(null);
    delegate().create.mockResolvedValue({ id: 9 });

    await create('Food');

    expect(delegate().findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: expect.objectContaining({ isActive: false, userId: USER_ID }) })
    );
    expect(delegate().create).toHaveBeenCalledWith({ data: { name: 'Food', userId: USER_ID, isActive: true } });
  });
});

describe('issue-87: getLabelTotals excludes disabled labels', () => {
  it('should query only active labels', async () => {
    (prisma.label.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.group.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.expense.groupBy as jest.Mock).mockResolvedValue([]);

    await labelService.getLabelTotals(USER_ID);

    expect(prisma.label.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    );
  });
});
