import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { ImageProcessorService } from './image-processor.service';
import { AppsModule } from '../apps/apps.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, AppsModule],
  controllers: [AssetsController],
  providers: [AssetsService, ImageProcessorService],
  exports: [AssetsService, ImageProcessorService],
})
export class AssetsModule {}
