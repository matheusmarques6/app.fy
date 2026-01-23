import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { QUEUE_NAMES } from '@appfy/shared';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.EVENTS_INGEST,
    }),
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
