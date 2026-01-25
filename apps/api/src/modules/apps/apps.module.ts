import { Module } from '@nestjs/common';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { KeypairService } from './keypair.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AppsController],
  providers: [AppsService, KeypairService],
  exports: [AppsService, KeypairService],
})
export class AppsModule {}
