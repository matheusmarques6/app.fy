import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';

// Common
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { StorageModule } from './common/storage/storage.module';
import { EncryptionModule } from './common/encryption/encryption.module';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { StoresModule } from './modules/stores/stores.module';
import { DevicesModule } from './modules/devices/devices.module';
import { EventsModule } from './modules/events/events.module';
import { SegmentsModule } from './modules/segments/segments.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { PushModule } from './modules/push/push.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { RemoteConfigModule } from './modules/remote-config/remote-config.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './common/health/health.module';

// App Builder modules
import { AppsModule } from './modules/apps/apps.module';
import { AssetsModule } from './modules/assets/assets.module';
import { CredentialsModule } from './modules/credentials/credentials.module';
import { BuildsModule } from './modules/builds/builds.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 200,
      },
    ]),

    // BullMQ - parse REDIS_URL or fallback to host/port
    BullModule.forRoot({
      connection: (() => {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          const url = new URL(redisUrl);
          return {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            password: url.password || undefined,
            username: url.username || undefined,
          };
        }
        return {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        };
      })(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),

    // Common
    PrismaModule,
    RedisModule,
    StorageModule,
    EncryptionModule,
    HealthModule,

    // Feature modules
    AuthModule,
    StoresModule,
    DevicesModule,
    EventsModule,
    SegmentsModule,
    AutomationsModule,
    CampaignsModule,
    PushModule,
    IntegrationsModule,
    RemoteConfigModule,
    WebhooksModule,
    AnalyticsModule,

    // App Builder modules
    AppsModule,
    AssetsModule,
    CredentialsModule,
    BuildsModule,
  ],
})
export class AppModule {}
