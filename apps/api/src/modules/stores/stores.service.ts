// @ts-nocheck
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateStoreRequest, UpdateStoreRequest, Store } from '@appfy/shared';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new store for an account
   */
  async create(
    accountId: string,
    userId: string,
    dto: CreateStoreRequest,
  ): Promise<Store> {
    // Check if user has permission on account
    const membership = await this.prisma.accountMembership.findFirst({
      where: {
        account_id: accountId,
        user_id: userId,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!membership) {
      throw new ForbiddenException('No permission to create stores in this account');
    }

    // Generate slug from name
    const slug = this.generateSlug(dto.name);

    // Check if slug is unique within account
    const existing = await this.prisma.store.findFirst({
      where: {
        account_id: accountId,
        slug,
      },
    });

    if (existing) {
      throw new ConflictException('Store with this name already exists');
    }

    // Create store with default settings
    const store = await this.prisma.store.create({
      data: {
        account_id: accountId,
        name: dto.name,
        slug,
        platform: dto.platform,
        primary_domain: dto.primary_domain,
        status: 'pending',
        settings: {
          timezone: dto.timezone || 'America/Sao_Paulo',
          default_locale: dto.default_locale || 'pt-BR',
          supported_locales: [dto.default_locale || 'pt-BR'],
          currency: dto.currency || 'BRL',
          push_config: {
            enabled: true,
            max_per_day_per_device: 5,
            max_per_minute_per_store: 10000,
          },
          allowlist: {
            primary_domains: [dto.primary_domain],
            asset_domains: [],
            payment_rules: [],
            default_for_non_allowlisted: 'external_browser',
          },
        },
      },
    });

    // Create store membership for user
    await this.prisma.storeMembership.create({
      data: {
        store_id: store.id,
        user_id: userId,
        role: 'owner',
      },
    });

    // Create default app for store
    await this.prisma.app.create({
      data: {
        store_id: store.id,
        name: dto.name,
        status: 'draft',
        config: {
          theme: {
            primary_color: '#000000',
            secondary_color: '#ffffff',
          },
          tabs: ['home', 'search', 'favorites', 'account', 'notifications'],
        },
      },
    });

    this.logger.log(`Store created: ${store.id} for account ${accountId}`);

    return this.mapToResponse(store);
  }

  /**
   * Get store by ID (with RLS check)
   */
  async findById(storeId: string, userId: string): Promise<Store> {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        memberships: {
          some: { user_id: userId },
        },
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return this.mapToResponse(store);
  }

  /**
   * Get all stores for a user
   */
  async findAllForUser(userId: string): Promise<Store[]> {
    const stores = await this.prisma.store.findMany({
      where: {
        memberships: {
          some: { user_id: userId },
        },
        status: { not: 'deleted' },
      },
      orderBy: { created_at: 'desc' },
    });

    return stores.map((s) => this.mapToResponse(s));
  }

  /**
   * Update store
   */
  async update(
    storeId: string,
    userId: string,
    dto: UpdateStoreRequest,
  ): Promise<Store> {
    // Check permission
    const membership = await this.prisma.storeMembership.findFirst({
      where: {
        store_id: storeId,
        user_id: userId,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!membership) {
      throw new ForbiddenException('No permission to update this store');
    }

    const store = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.primary_domain && { primary_domain: dto.primary_domain }),
        ...(dto.settings && {
          settings: dto.settings,
        }),
      },
    });

    return this.mapToResponse(store);
  }

  /**
   * Delete store (soft delete)
   */
  async delete(storeId: string, userId: string): Promise<void> {
    // Only owner can delete
    const membership = await this.prisma.storeMembership.findFirst({
      where: {
        store_id: storeId,
        user_id: userId,
        role: 'owner',
      },
    });

    if (!membership) {
      throw new ForbiddenException('Only owner can delete store');
    }

    await this.prisma.store.update({
      where: { id: storeId },
      data: { status: 'deleted' },
    });

    this.logger.log(`Store deleted: ${storeId}`);
  }

  /**
   * Get store statistics
   */
  async getStats(storeId: string) {
    const [devices, events, campaigns, automations] = await Promise.all([
      this.prisma.device.count({ where: { store_id: storeId } }),
      this.prisma.event.count({ where: { store_id: storeId } }),
      this.prisma.campaign.count({ where: { store_id: storeId } }),
      this.prisma.automation.count({ where: { store_id: storeId } }),
    ]);

    return {
      devices,
      events,
      campaigns,
      automations,
    };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private mapToResponse(store: any): Store {
    return {
      id: store.id,
      account_id: store.account_id,
      name: store.name,
      slug: store.slug,
      platform: store.platform,
      primary_domain: store.primary_domain,
      status: store.status,
      settings: store.settings,
      created_at: store.created_at.toISOString(),
      updated_at: store.updated_at.toISOString(),
    };
  }
}
