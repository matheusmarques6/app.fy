/**
 * E2E Test Helpers
 * Shared utilities for creating test app instances and authentication
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';

export interface TestContext {
  app: INestApplication;
  module: TestingModule;
  jwtService: JwtService;
}

/**
 * Creates a NestJS test application with the full AppModule
 * Uses real database and Redis connections from environment
 */
export async function createTestApp(): Promise<TestContext> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.init();

  const jwtService = module.get<JwtService>(JwtService);

  return { app, module, jwtService };
}

/**
 * Generate a test JWT token for authentication
 */
export function generateTestToken(
  jwtService: JwtService,
  payload: {
    sub: string;
    email?: string;
    type?: string;
  },
): string {
  return jwtService.sign({
    sub: payload.sub,
    email: payload.email || 'test@example.com',
    type: payload.type || 'human',
    iss: 'appfy-auth',
  });
}

/**
 * Close test app and clean up resources
 */
export async function closeTestApp(ctx: TestContext): Promise<void> {
  await ctx.app.close();
}
