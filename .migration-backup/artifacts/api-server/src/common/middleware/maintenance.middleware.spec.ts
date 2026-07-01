import { MaintenanceMiddleware } from './maintenance.middleware';
import { PrismaService } from '../../prisma/prisma.service';

const makeReqRes = (url: string, authHeader?: string) => {
  const req = {
    url,
    headers: authHeader ? { authorization: authHeader } : {},
    method: 'GET',
  };
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status };
  const next = jest.fn();
  return { req, res, next };
};

const makeJwt = (payload: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesig`;
};

const mockPrisma = {
  setting: { findUnique: jest.fn() },
};

describe('MaintenanceMiddleware', () => {
  let middleware: MaintenanceMiddleware;

  beforeEach(() => {
    middleware = new MaintenanceMiddleware(mockPrisma as unknown as PrismaService);
    // Reset static cache between tests
    (middleware as unknown as { cachedConfig: null; cacheExpiresAt: number })
      .cachedConfig = null;
    (middleware as unknown as { cachedConfig: null; cacheExpiresAt: number })
      .cacheExpiresAt = 0;
    jest.clearAllMocks();
  });

  it('passes through health check endpoints regardless of maintenance mode', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({
      value: { enabled: true, message: 'Down' },
    });
    const { req, res, next } = makeReqRes('/api/healthz');
    await middleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes through /health/* endpoints', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({
      value: { enabled: true, message: 'Down' },
    });
    const { req, res, next } = makeReqRes('/api/health/full');
    await middleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through normally when maintenance is disabled', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({ value: { enabled: false } });
    const { req, res, next } = makeReqRes('/api/v1/channels');
    await middleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks requests with 503 when maintenance is enabled', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({
      value: { enabled: true, message: 'Upgrading database', allowAdmins: false },
    });
    const { req, res, next } = makeReqRes('/api/v1/channels');
    await middleware.use(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
    const jsonArg = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.maintenance).toBe(true);
    expect(jsonArg.message).toContain('Upgrading database');
  });

  it('allows admin users through during maintenance when allowAdmins=true', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({
      value: { enabled: true, message: 'Down', allowAdmins: true },
    });
    const adminJwt = makeJwt({ sub: 'admin-1', role: 'admin' });
    const { req, res, next } = makeReqRes('/api/v1/channels', `Bearer ${adminJwt}`);
    await middleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows super_admin users through during maintenance', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({
      value: { enabled: true, allowAdmins: true },
    });
    const adminJwt = makeJwt({ sub: 'sa-1', role: 'super_admin' });
    const { req, res, next } = makeReqRes('/api/v1/settings', `Bearer ${adminJwt}`);
    await middleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks regular users even with a valid JWT during maintenance', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({
      value: { enabled: true, allowAdmins: true },
    });
    const userJwt = makeJwt({ sub: 'user-1', role: 'user' });
    const { req, res, next } = makeReqRes('/api/v1/channels', `Bearer ${userJwt}`);
    await middleware.use(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 with default message when no custom message is set', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({
      value: { enabled: true },
    });
    const { req, res, next } = makeReqRes('/api/v1/channels');
    await middleware.use(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(503);
    const json = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(json.message).toBeTruthy();
  });

  it('passes through when setting record does not exist (no maintenance key in DB)', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue(null);
    const { req, res, next } = makeReqRes('/api/v1/channels');
    await middleware.use(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
  });
});
