import { Request, Response, NextFunction } from 'express';
import { getThemeUsage } from '../themeController';
import * as themeService from '../../services/themeService';
import themeRoutes from '../../routes/themeRoutes';
import { AppError } from '../../errors/AppError';

jest.mock('../../services/themeService');
jest.mock('../../middlewares/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, nextFn: NextFunction) => nextFn(),
}));

describe('Theme Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, params: {}, query: {}, user: { id: 1 } as Request['user'] };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('getThemeUsage (GET /themes/usage)', () => {
    it('should return usage for the authenticated user with 200', async () => {
      const usage = [{ id: 1, name: 'Trip', groupCount: 1, expenseCount: 2 }];
      (themeService.getThemeUsage as jest.Mock).mockResolvedValue(usage);

      await getThemeUsage(req as Request, res as Response, next);

      expect(themeService.getThemeUsage).toHaveBeenCalledWith(1, false);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ statusCode: 200, data: usage });
    });

    it('should forward service errors to next()', async () => {
      const error = new AppError('GENERAL.INTERNAL_SERVER_ERROR', 500, 'DB_ERROR');
      (themeService.getThemeUsage as jest.Mock).mockRejectedValue(error);

      await getThemeUsage(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('route registration', () => {
    it('should register GET /usage before PATCH /:id so it is not shadowed', () => {
      interface RouteLayer { route?: { path: string; methods: Record<string, boolean> } }
      const layers = (themeRoutes as unknown as { stack: RouteLayer[] }).stack;
      const paths = layers.filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`);

      expect(paths).toContain('get /usage');
      // /:id is only registered for PATCH, so GET /usage cannot match it
      expect(paths).not.toContain('get /:id');
    });
  });
});
