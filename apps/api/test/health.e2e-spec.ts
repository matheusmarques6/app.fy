/**
 * E2E Test: Health Check
 * Verifies the API is running and dependencies are reachable
 */

import './setup';
import * as request from 'supertest';
import { createTestApp, closeTestApp, TestContext } from './helpers';

describe('Health (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('GET /v1/health/live should return ok', () => {
    return request(ctx.app.getHttpServer())
      .get('/v1/health/live')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('GET /v1/health should return health status with checks', () => {
    return request(ctx.app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('checks');
        expect(res.body.checks).toHaveProperty('database');
        expect(res.body.checks).toHaveProperty('redis');
      });
  });

  it('GET /v1/health/ready should check readiness', () => {
    return request(ctx.app.getHttpServer())
      .get('/v1/health/ready')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status');
        expect(['ready', 'not_ready']).toContain(res.body.status);
      });
  });
});
