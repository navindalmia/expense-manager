import { Request, Response, NextFunction } from 'express';
import { renameLabel } from '../labelController';
import * as labelService from '../../services/labelService';
import { AppError } from '../../errors/AppError';

jest.mock('../../services/labelService');

const USER_ID = 1;

describe('Label Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: { name: 'Renamed' }, params: { id: '5' }, user: { id: USER_ID } as Request['user'] };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('renameLabel (PATCH /labels/:id)', () => {
    it('should rename using the JWT user and numeric id param and return 200', async () => {
      (labelService.renameLabel as jest.Mock).mockResolvedValue({ id: 5, name: 'Renamed' });

      await renameLabel(req as Request, res as Response, next);

      expect(labelService.renameLabel).toHaveBeenCalledWith(USER_ID, 5, 'Renamed');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ statusCode: 200, data: { id: 5, name: 'Renamed' } });
    });

    it('should forward a validation error and not call the service when the name is empty', async () => {
      req.body = { name: '   ' };

      await renameLabel(req as Request, res as Response, next);

      expect(labelService.renameLabel).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.anything());
    });

    it('should forward a service conflict error to next()', async () => {
      const error = new AppError('LABEL.NAME_EXISTS', 409, 'LABEL_NAME_EXISTS');
      (labelService.renameLabel as jest.Mock).mockRejectedValue(error);

      await renameLabel(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
