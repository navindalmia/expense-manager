/**
 * Group Controller Tests
 *
 * Validates HTTP-layer behavior: happy-path status/body shape, invalid-id
 * rejection, and that service errors are forwarded to next() for the
 * central error handler rather than swallowed.
 */

import { Request, Response, NextFunction } from 'express';
import * as groupController from '../groupController';
import * as groupService from '../../services/groupService';
import { AppError } from '../../errors/AppError';

jest.mock('../../services/groupService');

describe('Group Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusCode: number;
  let jsonData: any;

  beforeEach(() => {
    jest.clearAllMocks();
    statusCode = 200;
    jsonData = null;

    req = { body: {}, params: {}, user: { id: 1 } as any };
    res = {
      status: jest.fn().mockImplementation((code: number) => {
        statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((data) => {
        jsonData = data;
        return res;
      }),
    };
    next = jest.fn();
  });

  describe('createGroup', () => {
    it('creates a group and returns 201', async () => {
      req.body = { name: 'Trip to Rome' };
      (groupService.createGroup as jest.Mock).mockResolvedValue({ id: 1, name: 'Trip to Rome' });

      await groupController.createGroup(req as Request, res as Response, next);

      expect(statusCode).toBe(201);
      expect(jsonData.success).toBe(true);
      expect(jsonData.data.id).toBe(1);
    });

    it('forwards validation errors to next()', async () => {
      req.body = { name: '' };

      await groupController.createGroup(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(groupService.createGroup).not.toHaveBeenCalled();
    });

    it('forwards service errors to next()', async () => {
      req.body = { name: 'Trip to Rome' };
      const error = new AppError('Currency GBP not found', 400, 'CURRENCY_NOT_FOUND');
      (groupService.createGroup as jest.Mock).mockRejectedValue(error);

      await groupController.createGroup(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getGroups', () => {
    it('returns groups with a count', async () => {
      (groupService.getUserGroups as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await groupController.getGroups(req as Request, res as Response, next);

      expect(statusCode).toBe(200);
      expect(jsonData.count).toBe(2);
    });
  });

  describe('getGroupById', () => {
    it('returns the group for a valid id', async () => {
      req.params = { id: '1' };
      (groupService.getGroupById as jest.Mock).mockResolvedValue({ id: 1 });

      await groupController.getGroupById(req as Request, res as Response, next);

      expect(statusCode).toBe(200);
      expect(jsonData.data.id).toBe(1);
    });

    it('returns 400 for a non-numeric id without calling the service', async () => {
      req.params = { id: 'abc' };

      await groupController.getGroupById(req as Request, res as Response, next);

      expect(statusCode).toBe(400);
      expect(groupService.getGroupById).not.toHaveBeenCalled();
    });

    it('forwards an authorization error to next()', async () => {
      req.params = { id: '1' };
      const error = new AppError('Unauthorized', 403, 'GROUP_UNAUTHORIZED');
      (groupService.getGroupById as jest.Mock).mockRejectedValue(error);

      await groupController.getGroupById(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('addMemberByEmail', () => {
    it('adds a member and returns 200', async () => {
      req.params = { id: '1' };
      req.body = { email: 'friend@test.com' };
      (groupService.addMemberByEmail as jest.Mock).mockResolvedValue({
        addedMember: { name: 'Friend', email: 'friend@test.com' },
      });

      await groupController.addMemberByEmail(req as Request, res as Response, next);

      expect(statusCode).toBe(200);
      expect(jsonData.message).toContain('Friend');
    });

    it('forwards invalid email input to next() without calling the service', async () => {
      req.params = { id: '1' };
      req.body = { email: 'not-an-email' };

      await groupController.addMemberByEmail(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(groupService.addMemberByEmail).not.toHaveBeenCalled();
    });

    it('forwards a non-creator rejection to next()', async () => {
      req.params = { id: '1' };
      req.body = { email: 'friend@test.com' };
      const error = new AppError('Unauthorized', 403, 'GROUP_UNAUTHORIZED');
      (groupService.addMemberByEmail as jest.Mock).mockRejectedValue(error);

      await groupController.addMemberByEmail(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateGroup', () => {
    it('updates the group and returns 200', async () => {
      req.params = { id: '1' };
      req.body = { name: 'Renamed' };
      (groupService.updateGroup as jest.Mock).mockResolvedValue({ id: 1, name: 'Renamed' });

      await groupController.updateGroup(req as Request, res as Response, next);

      expect(statusCode).toBe(200);
      expect(jsonData.data.name).toBe('Renamed');
    });

    it('forwards an invalid id error to next()', async () => {
      req.params = { id: 'abc' };

      await groupController.updateGroup(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(groupService.updateGroup).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('removes the member and returns 200', async () => {
      req.params = { id: '1', memberId: '2' };
      (groupService.removeMemberFromGroup as jest.Mock).mockResolvedValue({ id: 1 });

      await groupController.removeMember(req as Request, res as Response, next);

      expect(statusCode).toBe(200);
      expect(groupService.removeMemberFromGroup).toHaveBeenCalledWith(1, 2, 1);
    });

    it('forwards a cannot-remove-self rejection to next()', async () => {
      req.params = { id: '1', memberId: '1' };
      const error = new AppError('Cannot remove self', 400, 'CANNOT_REMOVE_SELF');
      (groupService.removeMemberFromGroup as jest.Mock).mockRejectedValue(error);

      await groupController.removeMember(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteGroup', () => {
    it('deactivates the group and returns 200', async () => {
      req.params = { id: '1' };
      (groupService.deactivateGroup as jest.Mock).mockResolvedValue({ id: 1, isActive: false });

      await groupController.deleteGroup(req as Request, res as Response, next);

      expect(statusCode).toBe(200);
      expect(jsonData.data.isActive).toBe(false);
    });

    it('forwards a non-creator rejection to next()', async () => {
      req.params = { id: '1' };
      const error = new AppError('Unauthorized', 403, 'GROUP_UNAUTHORIZED');
      (groupService.deactivateGroup as jest.Mock).mockRejectedValue(error);

      await groupController.deleteGroup(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getStats', () => {
    it('returns stats for a valid id', async () => {
      req.params = { id: '1' };
      (groupService.getGroupStats as jest.Mock).mockResolvedValue({ totalAmount: 100 });

      await groupController.getStats(req as Request, res as Response, next);

      expect(statusCode).toBe(200);
      expect(jsonData.data.totalAmount).toBe(100);
    });

    it('returns 400 for a non-numeric id without calling the service', async () => {
      req.params = { id: 'abc' };

      await groupController.getStats(req as Request, res as Response, next);

      expect(statusCode).toBe(400);
      expect(groupService.getGroupStats).not.toHaveBeenCalled();
    });
  });

  describe('getGroupExpenses', () => {
    it('returns expenses with a count', async () => {
      req.params = { id: '1' };
      (groupService.getGroupExpenses as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await groupController.getGroupExpenses(req as Request, res as Response, next);

      expect(statusCode).toBe(200);
      expect(jsonData.count).toBe(2);
    });

    it('forwards a non-member rejection to next()', async () => {
      req.params = { id: '1' };
      const error = new AppError('Unauthorized', 403, 'GROUP_UNAUTHORIZED');
      (groupService.getGroupExpenses as jest.Mock).mockRejectedValue(error);

      await groupController.getGroupExpenses(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
