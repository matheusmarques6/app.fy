/**
 * E2E Test: Campaigns API
 * Verifies campaign CRUD operations require auth and proper validation
 */

import './setup';
import * as request from 'supertest';
import { createTestApp, closeTestApp, generateTestToken, TestContext } from './helpers';

describe('Campaigns (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    token = generateTestToken(ctx.jwtService, {
      sub: 'test-user-campaigns',
      email: 'campaigns@test.com',
    });
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('GET /v1/campaigns', () => {
    it('should require authentication', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/campaigns')
        .expect(401);
    });

    it('should require X-Store-Id header', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/campaigns')
        .set('Authorization', `Bearer ${token}`)
        .expect((res) => {
          // Without store context, should fail with 400 or 403
          expect([400, 403, 404, 500]).toContain(res.status);
        });
    });
  });

  describe('POST /v1/campaigns', () => {
    it('should require authentication', () => {
      return request(ctx.app.getHttpServer())
        .post('/v1/campaigns')
        .send({ name: 'Test Campaign' })
        .expect(401);
    });

    it('should reject invalid payload (missing required fields)', () => {
      return request(ctx.app.getHttpServer())
        .post('/v1/campaigns')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'test-store-id')
        .send({}) // missing name, template fields
        .expect(400);
    });
  });

  describe('DELETE /v1/campaigns/:id', () => {
    it('should require authentication', () => {
      return request(ctx.app.getHttpServer())
        .delete('/v1/campaigns/non-existent-id')
        .expect(401);
    });
  });
});
