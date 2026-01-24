import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface DeviceFilters {
  platform?: 'ios' | 'android';
  hasCustomer?: boolean;
  hasPushSubscription?: boolean;
  lastSeenAfter?: Date;
  lastSeenBefore?: Date;
  search?: string;
}

interface UpdateDeviceDto {
  customer_id?: string | null;
  identity_confirmed?: boolean;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    storeId: string,
    page: number = 1,
    limit: number = 50,
    filters?: DeviceFilters,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      store_id: storeId,
    };

    if (filters?.platform) {
      where.platform = filters.platform;
    }

    if (filters?.hasCustomer !== undefined) {
      where.customer_id = filters.hasCustomer ? { not: null } : null;
    }

    if (filters?.hasPushSubscription !== undefined) {
      where.push_subscriptions = filters.hasPushSubscription
        ? { some: { opt_in: true } }
        : { none: {} };
    }

    if (filters?.lastSeenAfter) {
      where.last_seen_at = { ...where.last_seen_at, gte: filters.lastSeenAfter };
    }

    if (filters?.lastSeenBefore) {
      where.last_seen_at = { ...where.last_seen_at, lte: filters.lastSeenBefore };
    }

    if (filters?.search) {
      where.OR = [
        { device_fingerprint: { contains: filters.search, mode: 'insensitive' } },
        { app_instance_id: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip,
        take: limit,
        orderBy: { last_seen_at: 'desc' },
        select: {
          id: true,
          device_fingerprint: true,
          platform: true,
          locale: true,
          timezone: true,
          country_guess: true,
          customer_id: true,
          identity_confirmed: true,
          last_seen_at: true,
          created_at: true,
          customer: {
            select: {
              id: true,
              external_customer_id: true,
              tags: true,
            },
          },
          push_subscriptions: {
            where: { opt_in: true },
            select: {
              id: true,
              provider: true,
              opt_in: true,
            },
          },
          _count: {
            select: {
              events: true,
              orders: true,
              segment_memberships: true,
            },
          },
        },
      }),
      this.prisma.device.count({ where }),
    ]);

    return {
      data: devices,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(storeId: string, deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        customer: {
          select: {
            id: true,
            external_customer_id: true,
            tags: true,
            metadata: true,
          },
        },
        push_subscriptions: true,
        user_metrics: true,
        segment_memberships: {
          where: { exited_at: null },
          include: {
            segment: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            events: true,
            orders: true,
            deliveries: true,
            sessions: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.store_id !== storeId) {
      throw new ForbiddenException('Access denied');
    }

    return device;
  }

  async update(storeId: string, deviceId: string, dto: UpdateDeviceDto) {
    const device = await this.findOne(storeId, deviceId);

    // Validate customer belongs to same store if provided
    if (dto.customer_id) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customer_id },
      });
      if (!customer || customer.store_id !== storeId) {
        throw new NotFoundException('Customer not found');
      }
    }

    return this.prisma.device.update({
      where: { id: deviceId },
      data: {
        ...(dto.customer_id !== undefined && { customer_id: dto.customer_id }),
        ...(dto.identity_confirmed !== undefined && { identity_confirmed: dto.identity_confirmed }),
        updated_at: new Date(),
      },
      include: {
        customer: {
          select: {
            id: true,
            external_customer_id: true,
            tags: true,
          },
        },
      },
    });
  }

  async delete(storeId: string, deviceId: string) {
    await this.findOne(storeId, deviceId);

    await this.prisma.device.delete({
      where: { id: deviceId },
    });

    return { success: true };
  }

  async getEvents(
    storeId: string,
    deviceId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    await this.findOne(storeId, deviceId);

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where: { device_id: deviceId },
        skip,
        take: limit,
        orderBy: { ts: 'desc' },
        select: {
          id: true,
          name: true,
          props: true,
          ts: true,
          product_id: true,
          order_id: true,
        },
      }),
      this.prisma.event.count({ where: { device_id: deviceId } }),
    ]);

    return {
      data: events,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(storeId: string) {
    const [
      total,
      byPlatform,
      activeToday,
      activeLast7Days,
      withPushEnabled,
      withCustomer,
    ] = await Promise.all([
      this.prisma.device.count({ where: { store_id: storeId } }),
      this.prisma.device.groupBy({
        by: ['platform'],
        where: { store_id: storeId },
        _count: true,
      }),
      this.prisma.device.count({
        where: {
          store_id: storeId,
          last_seen_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.device.count({
        where: {
          store_id: storeId,
          last_seen_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.device.count({
        where: {
          store_id: storeId,
          push_subscriptions: { some: { opt_in: true } },
        },
      }),
      this.prisma.device.count({
        where: {
          store_id: storeId,
          customer_id: { not: null },
        },
      }),
    ]);

    const platformStats: Record<string, number> = {};
    for (const p of byPlatform) {
      platformStats[p.platform] = p._count;
    }

    return {
      total,
      by_platform: platformStats,
      active_today: activeToday,
      active_last_7_days: activeLast7Days,
      with_push_enabled: withPushEnabled,
      with_customer: withCustomer,
      push_opt_in_rate: total > 0 ? (withPushEnabled / total) * 100 : 0,
      identified_rate: total > 0 ? (withCustomer / total) * 100 : 0,
    };
  }
}
