import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { OneSignalProvider } from './providers/onesignal.provider';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [PushService, OneSignalProvider],
  exports: [PushService],
})
export class PushModule {}
