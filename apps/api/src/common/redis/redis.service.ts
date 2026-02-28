import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    const isTls = redisUrl.startsWith('rediss://');

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      ...(isTls && { tls: {}, enableOfflineQueue: false }),
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis error', err);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  getClient(): Redis {
    return this.client;
  }

  // =========================================================================
  // Rate Limiting
  // =========================================================================

  /**
   * Check and increment rate limit
   * Returns true if request is allowed, false if rate limited
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;

    const pipeline = this.client.pipeline();
    pipeline.incr(windowKey);
    pipeline.expire(windowKey, windowSeconds);
    pipeline.ttl(windowKey);

    const results = await pipeline.exec();
    const count = results?.[0]?.[1] as number || 0;
    const ttl = results?.[2]?.[1] as number || windowSeconds;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + ttl,
    };
  }

  // =========================================================================
  // Caching
  // =========================================================================

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  // =========================================================================
  // Token Management
  // =========================================================================

  /**
   * Add token to denylist (for revocation)
   */
  async denylistToken(jti: string, expiresInSeconds: number): Promise<void> {
    try {
      await this.client.setex(`token:deny:${jti}`, expiresInSeconds, '1');
    } catch (error) {
      this.logger.error(`Failed to denylist token: ${error}`);
      // Non-critical: token will naturally expire
    }
  }

  /**
   * Check if token is denylisted
   * Returns false on Redis errors to allow requests to proceed
   */
  async isTokenDenylisted(jti: string): Promise<boolean> {
    try {
      return (await this.client.exists(`token:deny:${jti}`)) === 1;
    } catch (error) {
      this.logger.error(`Failed to check token denylist: ${error}`);
      // Allow request to proceed if Redis is down
      return false;
    }
  }

  /**
   * Store refresh token hash for rotation detection
   */
  async setRefreshTokenHash(
    deviceId: string,
    familyId: string,
    hash: string,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.client.setex(
        `refresh:${deviceId}:${familyId}`,
        ttlSeconds,
        hash,
      );
    } catch (error) {
      this.logger.error(`Failed to store refresh token hash: ${error}`);
      // Non-critical: rotation detection will be disabled for this session
    }
  }

  /**
   * Get stored refresh token hash
   */
  async getRefreshTokenHash(
    deviceId: string,
    familyId: string,
  ): Promise<string | null> {
    try {
      return await this.client.get(`refresh:${deviceId}:${familyId}`);
    } catch (error) {
      this.logger.error(`Failed to get refresh token hash: ${error}`);
      // Return null to skip rotation check if Redis is down
      return null;
    }
  }

  // =========================================================================
  // Metrics / Counters
  // =========================================================================

  /**
   * Increment a metric counter
   */
  async incrementMetric(
    metric: string,
    storeId: string,
    dimensions?: Record<string, string>,
  ): Promise<void> {
    const dimSuffix = dimensions
      ? ':' + Object.entries(dimensions).map(([k, v]) => `${k}=${v}`).join(':')
      : '';
    const key = `metric:${metric}:${storeId}${dimSuffix}`;

    await this.client.incr(key);
    // Expire metrics after 7 days
    await this.client.expire(key, 7 * 24 * 60 * 60);
  }

  // =========================================================================
  // Webhook Deduplication
  // =========================================================================

  /**
   * Check if webhook event was already processed
   */
  async isWebhookProcessed(
    storeId: string,
    webhookId: string,
  ): Promise<boolean> {
    const key = `webhook:processed:${storeId}:${webhookId}`;
    return (await this.client.exists(key)) === 1;
  }

  /**
   * Mark webhook event as processed
   */
  async markWebhookProcessed(
    storeId: string,
    webhookId: string,
    ttlSeconds: number = 86400, // 24 hours
  ): Promise<void> {
    const key = `webhook:processed:${storeId}:${webhookId}`;
    await this.client.setex(key, ttlSeconds, '1');
  }
}
