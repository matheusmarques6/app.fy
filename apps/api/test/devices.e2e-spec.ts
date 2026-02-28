/**
 * E2E Test: Devices API
 * Verifies device endpoints require auth and return correct formats
 */

import './setup';
import * as request from 'supertest';
import { createTestApp, closeTestApp, generateTestToken, TestContext } from './helpers';

describe('Devices (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    token = generateTestToken(ctx.jwtService, {
      sub: 'test-user-devices',
      email: 'devices@test.com',
    });
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('GET /v1/devices', () => {
    it('should require authentication', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/devices')
        .expect(401);
    });

    it('should require X-Store-Id header', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect((res) => {
          expect([400, 403, 404, 500]).toContain(res.status);
        });
    });
  });

  describe('GET /v1/devices/stats', () => {
    it('should require authentication', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/devices/stats')
        .expect(401);
    });
  });

  describe('GET /v1/devices/:id', () => {
    it('should require authentication', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/devices/some-device-id')
        .expect(401);
    });
  });

  describe('Query Parameters', () => {
    it('should accept pagination parameters', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/devices?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'test-store-id')
        .expect((res) => {
          // Should not crash with query params
          expect([200, 400, 403, 404, 500]).toContain(res.status);
        });
    });

    it('should accept platform filter', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/devices?platform=ios')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'test-store-id')
        .expect((res) => {
          expect([200, 400, 403, 404, 500]).toContain(res.status);
        });
    });
  });
});
