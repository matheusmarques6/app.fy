import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShopifyProductDto } from '../integrations/dto/shopify.dto';
import { WooCommerceProductDto } from '../integrations/dto/woocommerce.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert a product from Shopify data
   * Handles both initial sync and webhook updates
   */
  async upsertFromShopify(storeId: string, product: ShopifyProductDto): Promise<void> {
    // Get primary price from first variant
    const price = product.variants?.[0]?.price
      ? parseFloat(product.variants[0].price)
      : 0;

    // Get primary image URL
    const imageUrl = product.images?.[0]?.src || null;

    // Parse tags (comma-separated string from Shopify)
    const tags = product.tags
      ? product.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    await this.prisma.product.upsert({
      where: {
        store_id_external_product_id: {
          store_id: storeId,
          external_product_id: product.id.toString(),
        },
      },
      create: {
        store_id: storeId,
        external_product_id: product.id.toString(),
        title: product.title,
        handle: product.handle,
        status: product.status || 'active',
        price,
        image_url: imageUrl,
        tags,
        metadata: {
          vendor: product.vendor,
          product_type: product.product_type,
          variants_count: product.variants?.length ?? 0,
          images_count: product.images?.length ?? 0,
          shopify_created_at: product.created_at,
          shopify_updated_at: product.updated_at,
        },
      },
      update: {
        title: product.title,
        handle: product.handle,
        status: product.status || 'active',
        price,
        image_url: imageUrl,
        tags,
        metadata: {
          vendor: product.vendor,
          product_type: product.product_type,
          variants_count: product.variants?.length ?? 0,
          images_count: product.images?.length ?? 0,
          shopify_created_at: product.created_at,
          shopify_updated_at: product.updated_at,
        },
        updated_at: new Date(),
      },
    });
  }

  /**
   * Upsert a product from WooCommerce data
   */
  async upsertFromWooCommerce(storeId: string, product: WooCommerceProductDto): Promise<void> {
    const price = product.price ? parseFloat(product.price) : 0;
    const imageUrl = product.images?.[0]?.src || null;
    const tags = product.categories?.map((c) => c.slug) ?? [];

    await this.prisma.product.upsert({
      where: {
        store_id_external_product_id: {
          store_id: storeId,
          external_product_id: product.id.toString(),
        },
      },
      create: {
        store_id: storeId,
        external_product_id: product.id.toString(),
        title: product.name,
        handle: product.slug,
        status: product.status === 'publish' ? 'active' : product.status,
        price,
        image_url: imageUrl,
        tags,
        metadata: {
          sku: product.sku,
          stock_status: product.stock_status,
          wc_created_at: product.date_created,
          wc_updated_at: product.date_modified,
        },
      },
      update: {
        title: product.name,
        handle: product.slug,
        status: product.status === 'publish' ? 'active' : product.status,
        price,
        image_url: imageUrl,
        tags,
        metadata: {
          sku: product.sku,
          stock_status: product.stock_status,
          wc_created_at: product.date_created,
          wc_updated_at: product.date_modified,
        },
        updated_at: new Date(),
      },
    });
  }

  /**
   * Soft-delete a product when Shopify sends products/delete webhook
   * Marks status as 'archived' to preserve order history references
   */
  async deleteByExternalId(storeId: string, externalProductId: string): Promise<void> {
    await this.prisma.product.updateMany({
      where: {
        store_id: storeId,
        external_product_id: externalProductId,
      },
      data: {
        status: 'archived',
        updated_at: new Date(),
      },
    });
  }

  /**
   * Find all products for a store
   */
  async findAllForStore(storeId: string, options?: { status?: string; limit?: number; offset?: number }) {
    return this.prisma.product.findMany({
      where: {
        store_id: storeId,
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  /**
   * Count products for a store
   */
  async countForStore(storeId: string): Promise<number> {
    return this.prisma.product.count({
      where: { store_id: storeId },
    });
  }
}
