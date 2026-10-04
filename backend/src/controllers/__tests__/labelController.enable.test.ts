import { Request, Response, NextFunction } from 'express';
import { enableLabel, getLabelTotals } from '../labelController';
import * as labelService from '../../services/labelService';
import labelRoutes from '../../routes/labelRoutes';
import { AppError } from '../../errors/AppError';
import { ZodError } from 'zod';

jest.mock('../../services/labelService');
jest.mock('../../middlewares/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, nextFn: NextFunction) => nextFn(),
}));

describe('Label Controller enable / includeDisabled', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, params: { id: '5' }, query: {}, user: { id: 1 } as Request['user'] };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  it('enableLabel returns the enabled row with 200', async () => {
    const row = { id: 5, name: 'Trip', isActive: true };
    (labelService.enableLabel as jest.Mock).mockResolvedValue(row);

    await enableLabel(req as Request, res as Response, next);

    expect(labelService.enableLabel).toHaveBeenCalledWith(1, 5);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ statusCode: 200, data: row });
  });

  it('enableLabel forwards a 409 name conflict to next()', async () => {
    const error = new AppError('LABEL.NAME_EXISTS', 409, 'LABEL_NAME_EXISTS');
    (labelService.enableLabel as jest.Mock).mockRejectedValue(error);

    await enableLabel(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('getLabelTotals passes includeDisabled=true when the query asks for it', async () => {
    req.query = { includeDisabled: 'true' };
    (labelService.getLabelTotals as jest.Mock).mockResolvedValue([]);

    await getLabelTotals(req as Request, res as Response, next);

    expect(labelService.getLabelTotals).toHaveBeenCalledWith(1, true);
  });

  it('getLabelTotals defaults includeDisabled to false', async () => {
    (labelService.getLabelTotals as jest.Mock).mockResolvedValue([]);

    await getLabelTotals(req as Request, res as Response, next);

    expect(labelService.getLabelTotals).toHaveBeenCalledWith(1, false);
  });

  it('getLabelTotals rejects an invalid includeDisabled value via Zod', async () => {
    req.query = { includeDisabled: 'maybe' };

    await getLabelTotals(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ZodError));
    expect(labelService.getLabelTotals).not.toHaveBeenCalled();
  });

  it('registers PATCH /:id/enable', () => {
    interface RouteLayer { route?: { path: string; methods: Record<string, boolean> } }
    const layers = (labelRoutes as unknown as { stack: RouteLayer[] }).stack;
    const paths = layers.filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods)[0]} ${l.route!.path}`);

    expect(paths).toContain('patch /:id/enable');
  });
});
