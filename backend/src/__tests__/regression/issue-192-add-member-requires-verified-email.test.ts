/**
 * Issue #192: POST /api/groups/:id/members skipped requireEmailVerified while
 * its sibling POST /api/groups/:id/members/email enforced it. Both member-add
 * routes must require a verified email.
 */

import type { Router, RequestHandler } from 'express';
import groupRoutes from '../../routes/groupRoutes';
import { requireEmailVerified } from '../../middlewares/emailVerificationMiddleware';

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler }[] };
}

function handlersFor(router: Router, method: string, path: string): RequestHandler[] {
  const layers = (router as unknown as { stack: RouteLayer[] }).stack;
  const layer = layers.find((l) => l.route?.path === path && l.route.methods[method]);
  return layer?.route?.stack.map((s) => s.handle) ?? [];
}

describe('member-add routes require a verified email (issue #192)', () => {
  it.each(['/:id/members', '/:id/members/email'])('should run requireEmailVerified on POST %s', (path) => {
    const handlers = handlersFor(groupRoutes, 'post', path);

    expect(handlers.length).toBeGreaterThan(0);
    expect(handlers).toContain(requireEmailVerified);
  });
});
