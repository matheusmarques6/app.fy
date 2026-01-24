import {
  Controller,
  Get,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private parseRange(from?: string, to?: string) {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    return {
      from: from ? new Date(from) : defaultFrom,
      to: to ? new Date(to) : now,
    };
  }

  @Get('overview')
  async getOverview(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const range = this.parseRange(from, to);
    return this.analyticsService.getOverview(storeId, range);
  }

  @Get('push')
  async getPushStats(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const range = this.parseRange(from, to);
    return this.analyticsService.getPushStats(storeId, range);
  }

  @Get('campaigns')
  async getCampaignStats(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const range = this.parseRange(from, to);
    return this.analyticsService.getCampaignStats(
      storeId,
      range,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('events')
  async getEventStats(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const range = this.parseRange(from, to);
    return this.analyticsService.getEventStats(
      storeId,
      range,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('revenue')
  async getRevenueAttribution(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const range = this.parseRange(from, to);
    return this.analyticsService.getRevenueAttribution(storeId, range);
  }

  @Get('automations')
  async getAutomationStats(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const range = this.parseRange(from, to);
    return this.analyticsService.getAutomationStats(storeId, range);
  }

  @Get('timeseries/devices')
  async getDevicesTimeSeries(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const range = this.parseRange(from, to);
    return this.analyticsService.getDevicesTimeSeries(storeId, range);
  }

  @Get('timeseries/orders')
  async getOrdersTimeSeries(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const range = this.parseRange(from, to);
    return this.analyticsService.getOrdersTimeSeries(storeId, range);
  }

  @Get('timeseries/events')
  async getEventsTimeSeries(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const range = this.parseRange(from, to);
    return this.analyticsService.getEventsTimeSeries(storeId, range);
  }
}
