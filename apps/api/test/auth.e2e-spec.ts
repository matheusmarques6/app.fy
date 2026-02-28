/**
 * E2E Test: Authentication Flow
 * Verifies JWT auth guard, protected routes, and token validation
 */

import './setup';
import * as request from 'supertest';
import { createTestApp, closeTestApp, generateTestToken, TestContext } from './helpers';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('Protected Routes', () => {
    it('GET /v1/stores should return 401 without token', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/stores')
        .expect(401);
    });

    it('GET /v1/stores should return 401 with invalid token', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/stores')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);
    });

    it('GET /v1/stores should return 401 with expired token', () => {
      const expiredToken = ctx.jwtService.sign(
        { sub: 'test-user-id', email: 'test@example.com', type: 'human', iss: 'appfy-auth' },
        { expiresIn: '0s' },
      );
      return request(ctx.app.getHttpServer())
        .get('/v1/stores')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('GET /v1/stores should accept valid token (may return empty array)', () => {
      const token = generateTestToken(ctx.jwtService, {
        sub: 'test-user-id-e2e',
        email: 'test-e2e@example.com',
      });
      return request(ctx.app.getHttpServer())
        .get('/v1/stores')
        .set('Authorization', `Bearer ${token}`)
        .expect((res) => {
          // Should be 200 with array, or 404 if user doesn't exist
          expect([200, 404]).toContain(res.status);
        });
    });
  });

  describe('Validation', () => {
    it('POST /v1/stores should reject invalid body', () => {
      const token = generateTestToken(ctx.jwtService, {
        sub: 'test-user-id-e2e',
      });
      return request(ctx.app.getHttpServer())
        .post('/v1/stores')
        .set('Authorization', `Bearer ${token}`)
        .send({}) // empty body — missing required fields
        .expect(400);
    });
  });
});
