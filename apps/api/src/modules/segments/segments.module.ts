import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SegmentsController } from './segments.controller';
import { SegmentsService } from './segments.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { QUEUE_NAMES } from '@appfy/shared';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.SEGMENT_FULL_REFRESH }),
  ],
  controllers: [SegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
