/** Issue #157: POST /api/currencies must require a valid JWT. */
import http from 'http';
import { AddressInfo } from 'net';
import app from '../../app';
import prisma from '../../lib/prisma';
import { generateToken } from '../../utils/jwtHelper';

describe('issue #157: currency creation requires authentication', () => {
  let server: http.Server;
  let base: string;
  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  const post = (auth?: string): Promise<Response> =>
    fetch(`${base}/api/currencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body: JSON.stringify({ code: 'xyz', label: 'Test' }),
    });

  it('should reject an unauthenticated request with 401 and write nothing', async () => {
    (prisma.currency.create as jest.Mock).mockClear();
    expect((await post()).status).toBe(401);
    expect(prisma.currency.create).not.toHaveBeenCalled();
  });

  it('should reject an invalid token with 401', async () => {
    expect((await post('Bearer not-a-real-token')).status).toBe(401);
  });

  it('should still create a currency for an authenticated caller', async () => {
    (prisma.currency.create as jest.Mock).mockResolvedValue({ id: 1, code: 'XYZ', label: 'Test' });
    expect((await post(`Bearer ${generateToken(1)}`)).status).toBe(201);
  });
});
