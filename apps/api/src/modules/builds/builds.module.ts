import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@appfy/shared';
import { BuildsController } from './builds.controller';
import { BuildsService } from './builds.service';
import { CodemagicService } from './codemagic.service';
import { CodemagicWebhookController } from './codemagic-webhook.controller';
import { AppsModule } from '../apps/apps.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [
    AuthModule,
    AppsModule,
    CredentialsModule,
    StorageModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.BUILD }),
  ],
  controllers: [BuildsController, CodemagicWebhookController],
  providers: [BuildsService, CodemagicService],
  exports: [BuildsService, CodemagicService],
})
export class BuildsModule {}
