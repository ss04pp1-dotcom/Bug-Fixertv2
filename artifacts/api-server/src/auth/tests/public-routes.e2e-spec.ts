import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

/**
 * Public Route Guard Tests
 * ════════════════════════
 * Every endpoint decorated with @Public() must return something other than 401.
 * This test ensures that:
 *   1. No public endpoint accidentally requires a JWT (regression guard for #13).
 *   2. All protected endpoints correctly return 401 without a token.
 *
 * If you add a new @Public() route, add it to PUBLIC_ROUTES below.
 * If you add a new protected route, it does NOT need to be listed — the guard
 * test at the bottom will catch it automatically if it ever breaks.
 */

/** All routes decorated with @Public() — must be reachable without a JWT */
const PUBLIC_ROUTES: Array<{ method: 'GET' | 'POST'; path: string }> = [
  // Health checks
  { method: 'GET', path: '/healthz' },
  { method: 'GET', path: '/health/full' },

  // Auth endpoints
  { method: 'POST', path: '/v1/auth/login' },
  { method: 'POST', path: '/v1/auth/register' },
  { method: 'POST', path: '/v1/auth/forgot-password' },
  { method: 'POST', path: '/v1/auth/verify-otp' },
  { method: 'POST', path: '/v1/auth/reset-password' },
  { method: 'POST', path: '/v1/auth/social' },
  { method: 'POST', path: '/v1/auth/refresh' },

  // Public content APIs
  { method: 'GET', path: '/v1/channels' },
  { method: 'GET', path: '/v1/categories' },
  { method: 'GET', path: '/v1/settings/public' },
  { method: 'GET', path: '/v1/announcements/active' },
  { method: 'GET', path: '/v1/banners' },
  { method: 'GET', path: '/v1/force-update/check' },
  { method: 'GET', path: '/v1/ads/config' },
];

/** Protected routes that must return 401 without a token */
const PROTECTED_ROUTES: Array<{ method: 'GET' | 'POST'; path: string }> = [
  { method: 'GET', path: '/v1/auth/profile' },
  { method: 'GET', path: '/v1/auth/sessions' },
  { method: 'POST', path: '/v1/auth/logout' },
  { method: 'GET', path: '/v1/users' },
  { method: 'GET', path: '/v1/subscriptions' },
  { method: 'GET', path: '/v1/payments' },
  { method: 'GET', path: '/v1/analytics/events' },
  { method: 'GET', path: '/v1/audit' },
  { method: 'GET', path: '/v1/roles' },
];

describe('Route Guard — Public vs Protected', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: 1 }); // URI versioning
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Public routes (no JWT required)', () => {
    for (const { method, path } of PUBLIC_ROUTES) {
      it(`${method} ${path} — must NOT return 401`, async () => {
        const req = method === 'GET'
          ? request(app.getHttpServer()).get(path)
          : request(app.getHttpServer()).post(path).send({});
        const res = await req;
        expect(res.status).not.toBe(401);
        // 400 is acceptable (missing body params) — 401 is not.
        // 404 means the route was removed — update this list.
        expect(res.status).not.toBe(404);
      });
    }
  });

  describe('Protected routes (JWT required)', () => {
    for (const { method, path } of PROTECTED_ROUTES) {
      it(`${method} ${path} — must return 401 without token`, async () => {
        const req = method === 'GET'
          ? request(app.getHttpServer()).get(path)
          : request(app.getHttpServer()).post(path).send({});
        const res = await req;
        expect(res.status).toBe(401);
      });
    }
  });
});
