/**
 * App-level hardening tests: security headers, CORS allowlist, internal-route
 * gating, route protection and rate limiting, exercised over real HTTP against
 * the Express app (Prisma is mocked globally by setup.ts).
 */
import http from 'http';
import { AddressInfo } from 'net';
import type { Express } from 'express';

const savedEnv = { ...process.env };

function loadApp(env: Record<string, string | undefined>): Express {
  process.env = { ...savedEnv };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../app').default as Express;
}

async function withServer<T>(app: Express, fn: (base: string) => Promise<T>): Promise<T> {
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

/** Prisma mock instance belonging to the most recently loaded app (resetModules makes new ones). */
function prismaMock(): { currency: { create: jest.Mock; findMany: jest.Mock } } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../lib/prisma').default;
}

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('security headers', () => {
  it('should send helmet headers', async () => {
    const app = loadApp({});
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/`);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-powered-by')).toBeNull();
    });
  });
});

describe('CORS allowlist', () => {
  it('should echo an allowed origin', async () => {
    const app = loadApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example' });
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/currencies`, { headers: { Origin: 'https://app.example' } });
      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example');
    });
  });

  it('should not grant CORS to an unlisted origin or use a wildcard', async () => {
    const app = loadApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example' });
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/currencies`, { headers: { Origin: 'https://other.example' } });
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  it('should still serve native clients that send no Origin', async () => {
    const app = loadApp({ NODE_ENV: 'production', CORS_ORIGINS: undefined });
    prismaMock().currency.findMany.mockResolvedValue([]);
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/currencies`);
      expect(res.status).toBe(200);
    });
  });

  it('should allow Expo web dev origins by default outside production', async () => {
    const app = loadApp({ NODE_ENV: 'development', CORS_ORIGINS: undefined });
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/`, { headers: { Origin: 'http://localhost:8081' } });
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    });
  });
});

describe('internal routes gating', () => {
  it.each([
    ['development', undefined, 404],
    ['development', 'false', 404],
    ['production', 'true', 404],
    ['development', 'true', 200],
  ])('NODE_ENV=%s ENABLE_INTERNAL_ROUTES=%s should respond %i', async (nodeEnv, flag, status) => {
    const app = loadApp({ NODE_ENV: nodeEnv, ENABLE_INTERNAL_ROUTES: flag });
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/internal/health`);
      expect(res.status).toBe(status);
    });
  });
});

describe('POST /api/currencies', () => {
  const body = JSON.stringify({ code: 'xyz', label: 'Test' });
  const headers = { 'Content-Type': 'application/json' };

  it('should return 401 without a token and not touch the database', async () => {
    const app = loadApp({});
    const create = prismaMock().currency.create;
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/currencies`, { method: 'POST', headers, body });
      expect(res.status).toBe(401);
      expect(create).not.toHaveBeenCalled();
    });
  });

  it('should return 201 with a valid token', async () => {
    const app = loadApp({});
    prismaMock().currency.create.mockResolvedValue({ id: 1, code: 'XYZ', label: 'Test' });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const token: string = require('../utils/jwtHelper').generateToken(1);
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/api/currencies`, {
        method: 'POST',
        headers: { ...headers, Authorization: `Bearer ${token}` },
        body,
      });
      expect(res.status).toBe(201);
    });
  });

  it('should keep GET public', async () => {
    const app = loadApp({});
    prismaMock().currency.findMany.mockResolvedValue([]);
    await withServer(app, async (base) => {
      expect((await fetch(`${base}/api/currencies`)).status).toBe(200);
    });
  });
});

describe('auth rate limiting', () => {
  const post = (base: string, path: string): Promise<Response> =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

  it.each([
    ['/api/auth/login', 'LOGIN'],
    ['/api/auth/signup', 'SIGNUP'],
    ['/api/auth/verify-email', 'VERIFY_EMAIL'],
  ])('%s should return 429 with the i18n error after the limit', async (path, name) => {
    const app = loadApp({ NODE_ENV: 'development', RATE_LIMIT_DISABLED: undefined, [`RATE_LIMIT_${name}_MAX`]: '2' });
    const { resetRateLimitStore } = jest.requireActual('../middlewares/rateLimitMiddleware');
    resetRateLimitStore();
    await withServer(app, async (base) => {
      expect((await post(base, path)).status).not.toBe(429);
      expect((await post(base, path)).status).not.toBe(429);
      const res = await post(base, path);
      expect(res.status).toBe(429);
      expect(res.headers.get('retry-after')).not.toBeNull();
      const json = (await res.json()) as { code: string; error: string };
      expect(json.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(json.error).not.toBe('RATE_LIMIT.EXCEEDED'); // translated, not the raw key
    });
  });

  it('should not throttle when RATE_LIMIT_DISABLED=true', async () => {
    const app = loadApp({ NODE_ENV: 'development', RATE_LIMIT_DISABLED: 'true', RATE_LIMIT_LOGIN_MAX: '1' });
    await withServer(app, async (base) => {
      for (let i = 0; i < 5; i++) expect((await post(base, '/api/auth/login')).status).not.toBe(429);
    });
  });
});

describe('trust proxy', () => {
  it('should trust one proxy hop in production', () => {
    expect(loadApp({ NODE_ENV: 'production', TRUST_PROXY: undefined }).get('trust proxy')).toBe(1);
  });
  it('should not trust X-Forwarded-For outside production by default', () => {
    expect(loadApp({ NODE_ENV: 'development', TRUST_PROXY: undefined }).get('trust proxy')).toBeFalsy();
  });
  it('should honour TRUST_PROXY override', () => {
    expect(loadApp({ NODE_ENV: 'production', TRUST_PROXY: '2' }).get('trust proxy')).toBe(2);
  });
});
