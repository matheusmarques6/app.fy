import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface UpdateDeviceDto {
  customer_id?: string | null;
  identity_confirmed?: boolean;
}

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  async findAll(
    @Headers('x-store-id') storeId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('platform') platform?: 'ios' | 'android',
    @Query('has_customer') hasCustomer?: string,
    @Query('has_push') hasPush?: string,
    @Query('last_seen_after') lastSeenAfter?: string,
    @Query('last_seen_before') lastSeenBefore?: string,
    @Query('search') search?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    const filters: any = {};

    if (platform) {
      filters.platform = platform;
    }

    if (hasCustomer !== undefined) {
      filters.hasCustomer = hasCustomer === 'true';
    }

    if (hasPush !== undefined) {
      filters.hasPushSubscription = hasPush === 'true';
    }

    if (lastSeenAfter) {
      const date = new Date(lastSeenAfter);
      if (!isNaN(date.getTime())) {
        filters.lastSeenAfter = date;
      }
    }

    if (lastSeenBefore) {
      const date = new Date(lastSeenBefore);
      if (!isNaN(date.getTime())) {
        filters.lastSeenBefore = date;
      }
    }

    if (search) {
      filters.search = search;
    }

    return this.devicesService.findAll(
      storeId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      filters,
    );
  }

  @Get('stats')
  async getStats(@Headers('x-store-id') storeId: string) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.devicesService.getStats(storeId);
  }

  @Get(':id')
  async findOne(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.devicesService.findOne(storeId, id);
  }

  @Put(':id')
  async update(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.devicesService.update(storeId, id, dto);
  }

  @Delete(':id')
  async delete(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.devicesService.delete(storeId, id);
  }

  @Get(':id/events')
  async getEvents(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.devicesService.getEvents(
      storeId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
