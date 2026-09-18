/**
 * Delete Group Tests
 *
 * Regression coverage for a real bug found while wiring up issue #47's
 * delete-group UI for the first time: groupService.deactivateGroup threw
 * raw `Error` instances instead of `AppError`. Since the controller's
 * catch block does `next(error)` (delegating to the global error
 * handler), a raw Error is NOT an `instanceof AppError`, so the handler
 * fell through to its generic 500 "Internal Server Error" branch instead
 * of the correct 404 (group not found) or 403 (not the creator) response
 * -- the deletion was still correctly denied either way (fails closed,
 * not open), but with the wrong status code and a message that gave the
 * user no real information. This was previously unreachable from any UI
 * (deleteGroup() was dead code), so it went unnoticed until now.
 */

import { Request, Response, NextFunction } from 'express';
import { deleteGroup } from '../../controllers/groupController';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';

jest.mock('../../lib/prisma');

describe('deleteGroup controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonMock = jest.fn().mockReturnValue(undefined);
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockNext = jest.fn();

    mockReq = {
      params: { id: '1' },
      user: { id: 1 } as any,
    };
    mockRes = { status: statusMock };
  });

  it('should pass a 404 AppError to next() when the group does not exist', async () => {
    (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);

    await deleteGroup(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledTimes(1);
    const passedError = mockNext.mock.calls[0][0];
    expect(passedError).toBeInstanceOf(AppError);
    expect(passedError.statusCode).toBe(404);
    expect(passedError.code).toBe('GROUP_NOT_FOUND');
  });

  it('should pass a 403 AppError to next() when the requester is not the group creator', async () => {
    (prisma.group.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      createdById: 999,
    });

    await deleteGroup(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledTimes(1);
    const passedError = mockNext.mock.calls[0][0];
    expect(passedError).toBeInstanceOf(AppError);
    expect(passedError.statusCode).toBe(403);
    expect(passedError.code).toBe('GROUP_UNAUTHORIZED');
  });

  it('should soft-delete and return the group when the requester is the creator', async () => {
    (prisma.group.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      createdById: 1,
    });
    (prisma.group.update as jest.Mock).mockResolvedValue({
      id: 1,
      createdById: 1,
      isActive: false,
    });

    await deleteGroup(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockNext).not.toHaveBeenCalled();
    expect(prisma.group.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 1, isActive: false }),
      })
    );
  });
});
