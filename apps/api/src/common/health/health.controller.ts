import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, { status: string; latency?: number }> = {};

    // Database check
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', latency: Date.now() - dbStart };
    } catch (error) {
      checks.database = { status: 'error' };
    }

    // Redis check
    const redisStart = Date.now();
    try {
      await this.redis.getClient().ping();
      checks.redis = { status: 'ok', latency: Date.now() - redisStart };
    } catch (error) {
      checks.redis = { status: 'error' };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.getClient().ping();
      return { status: 'ready' };
    } catch (error) {
      return { status: 'not_ready' };
    }
  }
}
