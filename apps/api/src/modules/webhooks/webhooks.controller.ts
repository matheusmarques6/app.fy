import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  async findAll(
    @Headers('x-store-id') storeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('provider') provider?: 'shopify' | 'woocommerce',
    @Query('topic') topic?: string,
    @Query('status') status?: 'received' | 'processing' | 'processed' | 'failed',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    const filters: any = {};

    if (provider) filters.provider = provider;
    if (topic) filters.topic = topic;
    if (status) filters.status = status;

    if (from) {
      const date = new Date(from);
      if (!isNaN(date.getTime())) filters.from = date;
    }

    if (to) {
      const date = new Date(to);
      if (!isNaN(date.getTime())) filters.to = date;
    }

    return this.webhooksService.findAll(
      storeId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      filters,
    );
  }

  @Get('stats')
  async getStats(
    @Headers('x-store-id') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return this.webhooksService.getStats(storeId, fromDate, toDate);
  }

  @Get(':id')
  async findOne(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.webhooksService.findOne(storeId, id);
  }

  @Post(':id/retry')
  async retry(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.webhooksService.retry(storeId, id);
  }

  @Post('bulk-retry')
  async bulkRetry(
    @Headers('x-store-id') storeId: string,
    @Body() body: { event_ids: string[] },
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    if (!body.event_ids || !Array.isArray(body.event_ids)) {
      throw new BadRequestException('event_ids array is required');
    }

    return this.webhooksService.bulkRetry(storeId, body.event_ids);
  }

  @Delete('cleanup')
  async cleanup(
    @Headers('x-store-id') storeId: string,
    @Query('older_than_days') olderThanDays?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    const days = olderThanDays ? parseInt(olderThanDays, 10) : 30;

    if (days < 7) {
      throw new BadRequestException('Cannot delete events newer than 7 days');
    }

    return this.webhooksService.cleanup(storeId, days);
  }
}
