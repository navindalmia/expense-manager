import { findOrReactivate } from '../masterDataLookup';

describe('findOrReactivate', () => {
  const makeOps = (active: unknown, disabled: unknown) => ({
    findActiveVisible: jest.fn().mockResolvedValue(active),
    findOwnDisabled: jest.fn().mockResolvedValue(disabled),
    reactivate: jest.fn().mockResolvedValue({ id: 2, isActive: true }),
    create: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
  });

  it('should return the active row without touching anything else', async () => {
    const ops = makeOps({ id: 1, isActive: true }, null);
    await expect(findOrReactivate(ops as never)).resolves.toEqual({ id: 1, isActive: true });
    expect(ops.findOwnDisabled).not.toHaveBeenCalled();
    expect(ops.create).not.toHaveBeenCalled();
  });

  it('should reactivate a disabled row when no active match exists', async () => {
    const ops = makeOps(null, { id: 2, isActive: false });
    await findOrReactivate(ops as never);
    expect(ops.reactivate).toHaveBeenCalledWith(2);
    expect(ops.create).not.toHaveBeenCalled();
  });

  it('should create when nothing matches', async () => {
    const ops = makeOps(null, null);
    await expect(findOrReactivate(ops as never)).resolves.toEqual({ id: 3, isActive: true });
  });
});
