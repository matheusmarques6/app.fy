import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ShopifyService } from './services/shopify.service';
import { ShopifyController } from './controllers/shopify.controller';
import { WooCommerceService } from './services/woocommerce.service';
import { WooCommerceController } from './controllers/woocommerce.controller';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ShopifyController, WooCommerceController],
  providers: [ShopifyService, WooCommerceService],
  exports: [ShopifyService, WooCommerceService],
})
export class IntegrationsModule {}
