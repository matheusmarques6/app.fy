import { Module } from '@nestjs/common';
import { RemoteConfigController } from './remote-config.controller';
import { RemoteConfigService } from './remote-config.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule],
  controllers: [RemoteConfigController],
  providers: [RemoteConfigService],
  exports: [RemoteConfigService],
})
export class RemoteConfigModule {}
