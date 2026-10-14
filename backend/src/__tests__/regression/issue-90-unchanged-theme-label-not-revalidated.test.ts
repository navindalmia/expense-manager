/**
 * Issue #90: themes/labels are per-user, so a group member editing someone
 * else's expense resubmits the creator's themeId/labelId on every save.
 * updateExpense must not re-validate an unchanged id (it 404'd before).
 */
import * as expenseService from '../../services/expenseService';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma');
jest.mock('../../utils/cleanData', () => ({ cleanData: (data: unknown) => data }));

const EDITOR_ID = 2;
const CREATOR_ID = 1;

describe('issue #90: unchanged theme/label is not re-validated on update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.expense.update as jest.Mock).mockResolvedValue({ id: 1 });
    (prisma.expense.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      amount: 100,
      splitType: 'EQUAL',
      splitAmount: [],
      splitPercentage: [],
      themeId: 4,
      labelId: 7,
      group: { id: 1, createdById: CREATOR_ID, members: [{ id: CREATOR_ID }, { id: EDITOR_ID }] },
      splitWith: [{ id: CREATOR_ID }, { id: EDITOR_ID }],
    });
  });

  it('should succeed without lookups when themeId/labelId equal the current ones owned by another user', async () => {
    (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 4, userId: CREATOR_ID, isActive: false });
    (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 7, userId: CREATOR_ID, isActive: false });

    await expenseService.updateExpense(1, EDITOR_ID, { themeId: 4, labelId: 7, title: 'Renamed' });

    expect(prisma.expense.update).toHaveBeenCalled();
    expect(prisma.theme.findUnique).not.toHaveBeenCalled();
    expect(prisma.label.findUnique).not.toHaveBeenCalled();
  });

  it('should reject a different disabled theme', async () => {
    (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: EDITOR_ID, isActive: false });

    await expect(expenseService.updateExpense(1, EDITOR_ID, { themeId: 5 })).rejects.toThrow('THEME.NOT_FOUND');
    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it('should reject a different theme owned by another user', async () => {
    (prisma.theme.findUnique as jest.Mock).mockResolvedValue({ id: 5, userId: CREATOR_ID, isActive: true });

    await expect(expenseService.updateExpense(1, EDITOR_ID, { themeId: 5 })).rejects.toThrow('THEME.NOT_FOUND');
  });

  it('should reject a different disabled label', async () => {
    (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 8, userId: EDITOR_ID, isActive: false });

    await expect(expenseService.updateExpense(1, EDITOR_ID, { labelId: 8 })).rejects.toThrow('LABEL.NOT_FOUND');
    expect(prisma.expense.update).not.toHaveBeenCalled();
  });

  it('should reject a different label owned by another user', async () => {
    (prisma.label.findUnique as jest.Mock).mockResolvedValue({ id: 8, userId: CREATOR_ID, isActive: true });

    await expect(expenseService.updateExpense(1, EDITOR_ID, { labelId: 8 })).rejects.toThrow('LABEL.NOT_FOUND');
  });
});
