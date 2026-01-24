import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { QUEUE_NAMES } from '@appfy/shared';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.WEBHOOK_PROCESS,
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
