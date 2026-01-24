import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@appfy/shared';

// Common modules
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

// Feature modules
import { PushModule } from '../modules/push/push.module';

// Processors
import { EventsProcessor } from './processors/events.processor';
import { MetricsProcessor } from './processors/metrics.processor';
import { SegmentProcessor } from './processors/segment.processor';
import { AutomationProcessor } from './processors/automation.processor';
import { PushProcessor } from './processors/push.processor';
import { CampaignProcessor } from './processors/campaign.processor';
import { IntegrationsProcessor } from './processors/integrations.processor';

// Services needed by processors
import { ShopifyService } from '../modules/integrations/services/shopify.service';
import { WooCommerceService } from '../modules/integrations/services/woocommerce.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

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
    }),

    // Register all queues
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EVENTS_INGEST },
      { name: QUEUE_NAMES.METRICS_UPDATE },
      { name: QUEUE_NAMES.SEGMENT_REFRESH },
      { name: QUEUE_NAMES.AUTOMATION_EVAL },
      { name: QUEUE_NAMES.PUSH_SEND },
      { name: QUEUE_NAMES.CAMPAIGN_SEND },
      { name: QUEUE_NAMES.INTEGRATIONS_SYNC },
    ),

    PrismaModule,
    RedisModule,
    PushModule,
  ],
  providers: [
    // Processors
    EventsProcessor,
    MetricsProcessor,
    SegmentProcessor,
    AutomationProcessor,
    PushProcessor,
    CampaignProcessor,
    IntegrationsProcessor,
    // Services needed by IntegrationsProcessor
    ShopifyService,
    WooCommerceService,
  ],
})
export class WorkersModule {}
