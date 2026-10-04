/**
 * Label enable / includeDisabled tests (Manage Labels: Disable becomes Enable).
 */

import * as labelService from '../labelService';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');

const OWNER_ID = 1;
const OTHER_USER_ID = 2;
const model = prisma.label as unknown as {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  update: jest.Mock;
};

describe('LabelService enable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const disabled = { id: 5, name: 'Trip', userId: OWNER_ID, isActive: false };

  it('re-enables an owned disabled label', async () => {
    model.findUnique.mockResolvedValue(disabled);
    model.findFirst.mockResolvedValue(null);
    model.update.mockResolvedValue({ ...disabled, isActive: true });

    const result = await labelService.enableLabel(OWNER_ID, 5);

    expect(model.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { isActive: true } });
    expect(result.isActive).toBe(true);
  });

  it('is idempotent when the label is already active', async () => {
    const active = { ...disabled, isActive: true };
    model.findUnique.mockResolvedValue(active);

    const result = await labelService.enableLabel(OWNER_ID, 5);

    expect(result).toEqual(active);
    expect(model.update).not.toHaveBeenCalled();
  });

  it('returns 409 NAME_EXISTS when another active label has the same name', async () => {
    model.findUnique.mockResolvedValue(disabled);
    model.findFirst.mockResolvedValue({ id: 9, name: 'trip', userId: OWNER_ID, isActive: true });

    const promise = labelService.enableLabel(OWNER_ID, 5);

    await expect(promise).rejects.toMatchObject({ statusCode: 409, message: 'LABEL.NAME_EXISTS' });
    expect(model.update).not.toHaveBeenCalled();
    expect(model.findFirst).toHaveBeenCalledWith({
      where: {
        name: { equals: 'Trip', mode: 'insensitive' },
        id: { not: 5 },
        isActive: true,
        OR: [{ userId: OWNER_ID }, { userId: null }],
      },
    });
  });

  it('throws 404 when the label does not exist', async () => {
    model.findUnique.mockResolvedValue(null);

    await expect(labelService.enableLabel(OWNER_ID, 5)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 403 when the label belongs to someone else', async () => {
    model.findUnique.mockResolvedValue({ ...disabled, userId: OTHER_USER_ID });

    await expect(labelService.enableLabel(OWNER_ID, 5)).rejects.toBeInstanceOf(AppError);
    await expect(labelService.enableLabel(OWNER_ID, 5)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects a global (system) label as not owned', async () => {
    model.findUnique.mockResolvedValue({ ...disabled, userId: null });

    await expect(labelService.enableLabel(OWNER_ID, 5)).rejects.toMatchObject({ statusCode: 403 });
    expect(model.update).not.toHaveBeenCalled();
  });

  it('allows renaming a disabled label (rename does not require active)', async () => {
    model.findUnique.mockResolvedValue(disabled);
    model.findFirst.mockResolvedValue(null);
    model.update.mockResolvedValue({ ...disabled, name: 'Holiday' });

    await expect(labelService.renameLabel(OWNER_ID, 5, 'Holiday')).resolves.toMatchObject({ name: 'Holiday' });
  });
});

describe('LabelService includeDisabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    model.findMany.mockResolvedValue([]);
    (prisma.group.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.group.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.expense.groupBy as jest.Mock).mockResolvedValue([]);
  });

  it('default list for pickers still excludes disabled rows', async () => {
    await labelService.listLabels(OWNER_ID);

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, OR: [{ userId: null }, { userId: OWNER_ID }] } })
    );
  });

  it('getLabelTotals excludes disabled rows by default', async () => {
    await labelService.getLabelTotals(OWNER_ID);

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, OR: [{ userId: null }, { userId: OWNER_ID }] } })
    );
  });

  it('getLabelTotals includes the caller\'s own disabled rows (never other users\' or disabled globals) when asked', async () => {
    await labelService.getLabelTotals(OWNER_ID, true);

    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ userId: null, isActive: true }, { userId: OWNER_ID }] },
      })
    );
  });
});
