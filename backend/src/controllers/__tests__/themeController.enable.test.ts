import { Request, Response, NextFunction } from 'express';
import { enableTheme, getThemeUsage } from '../themeController';
import * as themeService from '../../services/themeService';
import themeRoutes from '../../routes/themeRoutes';
import { AppError } from '../../errors/AppError';
import { ZodError } from 'zod';

jest.mock('../../services/themeService');
jest.mock('../../middlewares/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, nextFn: NextFunction) => nextFn(),
}));

describe('Theme Controller enable / includeDisabled', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, params: { id: '5' }, query: {}, user: { id: 1 } as Request['user'] };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  it('enableTheme returns the enabled row with 200', async () => {
    const row = { id: 5, name: 'Trip', isActive: true };
    (themeService.enableTheme as jest.Mock).mockResolvedValue(row);

    await enableTheme(req as Request, res as Response, next);

    expect(themeService.enableTheme).toHaveBeenCalledWith(1, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ statusCode: 200, data: row });
  });

  it('enableTheme forwards a 409 name conflict to next()', async () => {
    const error = new AppError('THEME.NAME_EXISTS', 409, 'THEME_NAME_EXISTS');
    (themeService.enableTheme as jest.Mock).mockRejectedValue(error);

    await enableTheme(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('getThemeUsage passes includeDisabled=true when the query asks for it', async () => {
    req.query = { includeDisabled: 'true' };
    (themeService.getThemeUsage as jest.Mock).mockResolvedValue([]);

    await getThemeUsage(req as Request, res as Response, next);

    expect(themeService.getThemeUsage).toHaveBeenCalledWith(1, true);
  });

  it('getThemeUsage defaults includeDisabled to false', async () => {
    (themeService.getThemeUsage as jest.Mock).mockResolvedValue([]);

    await getThemeUsage(req as Request, res as Response, next);

    expect(themeService.getThemeUsage).toHaveBeenCalledWith(1, false);
  });

  it('getThemeUsage rejects an invalid includeDisabled value via Zod', async () => {
    req.query = { includeDisabled: 'maybe' };

    await getThemeUsage(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ZodError));
    expect(themeService.getThemeUsage).not.toHaveBeenCalled();
  });

  it('registers PATCH /:id/enable', () => {
    interface RouteLayer { route?: { path: string; methods: Record<string, boolean> } }
    const layers = (themeRoutes as unknown as { stack: RouteLayer[] }).stack;
    const paths = layers.filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`);

    expect(paths).toContain('patch /:id/enable');
  });
});
