import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ShopifyService } from './services/shopify.service';
import { ShopifyController } from './controllers/shopify.controller';
import { WooCommerceService } from './services/woocommerce.service';
import { WooCommerceController } from './controllers/woocommerce.controller';
import { QUEUE_NAMES } from '@appfy/shared';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuthModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.INTEGRATIONS_SYNC,
    }),
  ],
  controllers: [ShopifyController, WooCommerceController],
  providers: [ShopifyService, WooCommerceService],
  exports: [ShopifyService, WooCommerceService],
})
export class IntegrationsModule {}
