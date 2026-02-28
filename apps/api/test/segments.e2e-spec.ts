/**
 * E2E Test: Segments API
 * Verifies segment CRUD operations and validation
 */

import './setup';
import * as request from 'supertest';
import { createTestApp, closeTestApp, generateTestToken, TestContext } from './helpers';

describe('Segments (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    token = generateTestToken(ctx.jwtService, {
      sub: 'test-user-segments',
      email: 'segments@test.com',
    });
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('GET /v1/segments', () => {
    it('should require authentication', () => {
      return request(ctx.app.getHttpServer())
        .get('/v1/segments')
        .expect(401);
    });
  });

  describe('POST /v1/segments', () => {
    it('should require authentication', () => {
      return request(ctx.app.getHttpServer())
        .post('/v1/segments')
        .send({ name: 'Test Segment' })
        .expect(401);
    });

    it('should reject invalid payload', () => {
      return request(ctx.app.getHttpServer())
        .post('/v1/segments')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'test-store-id')
        .send({ name: '' }) // invalid: empty name
        .expect(400);
    });
  });

  describe('POST /v1/segments/preview', () => {
    it('should require authentication', () => {
      return request(ctx.app.getHttpServer())
        .post('/v1/segments/preview')
        .send({ definition: { match: 'all', rules: [] } })
        .expect(401);
    });
  });
});
