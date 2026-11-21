/** Issue #182: the resend-verification limiter must stay bounded and cannot be fanned out across emails from one IP. */
import { createRateLimitMiddleware, rateLimitResendVerificationByIp, resetRateLimitStore, rateLimitStoreSize } from '../../middlewares/rateLimitMiddleware';
import { AppError } from '../../errors/AppError';
import type { Request, Response, NextFunction } from 'express';

function call(mw: ReturnType<typeof createRateLimitMiddleware>, req: Partial<Request>): jest.Mock {
  const next = jest.fn();
  mw(req as Request, { setHeader: jest.fn() } as unknown as Response, next as unknown as NextFunction);
  return next;
}

describe('issue #182: bounded resend-verification limiter', () => {
  beforeEach(() => resetRateLimitStore());

  it('should reject one IP after its per-IP budget regardless of the email used', () => {
    process.env.RATE_LIMIT_RESEND_VERIFICATION_IP_MAX = '1';
    call(rateLimitResendVerificationByIp, { ip: '192.0.2.1', body: { email: 'a@x.com' } });
    const next = call(rateLimitResendVerificationByIp, { ip: '192.0.2.1', body: { email: 'b@x.com' } });
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
    delete process.env.RATE_LIMIT_RESEND_VERIFICATION_IP_MAX;
  });

  it('should never track more than the store cap', () => {
    const mw = createRateLimitMiddleware({ maxRequests: 1, windowMs: 3_600_000 }, (r) => String(r.ip));
    for (let i = 0; i < 10_050; i++) call(mw, { ip: `u-${i}` });
    expect(rateLimitStoreSize()).toBeLessThanOrEqual(10_000);
  });
});
