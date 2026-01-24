import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface CreateCampaignDto {
  name: string;
  description?: string;
  type?: 'one_time' | 'recurring' | 'triggered';
  segment_id?: string;
  timezone?: string;
  // Template content
  template_name?: string;
  title: Record<string, string>; // { "pt-BR": "...", "en-US": "..." }
  body: Record<string, string>;
  image_url?: string;
  deeplink?: string;
  data?: Record<string, any>;
}

interface UpdateCampaignDto {
  name?: string;
  description?: string;
  segment_id?: string;
  timezone?: string;
  // Template content
  title?: Record<string, string>;
  body?: Record<string, string>;
  image_url?: string;
  deeplink?: string;
  data?: Record<string, any>;
}

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async findAll(
    @Headers('x-store-id') storeId: string,
    @Query('status') status?: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled',
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.campaignsService.findAll(storeId, status);
  }

  @Get(':id')
  async findOne(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.campaignsService.findOne(storeId, id);
  }

  @Post()
  async create(
    @Headers('x-store-id') storeId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.campaignsService.create(storeId, dto);
  }

  @Put(':id')
  async update(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.campaignsService.update(storeId, id, dto);
  }

  @Delete(':id')
  async delete(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.campaignsService.delete(storeId, id);
  }

  @Post(':id/schedule')
  async schedule(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
    @Body() body: { scheduled_for: string },
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    const scheduledFor = new Date(body.scheduled_for);
    if (isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Invalid scheduled_for date');
    }
    return this.campaignsService.schedule(storeId, id, scheduledFor);
  }

  @Post(':id/send')
  async sendNow(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.campaignsService.sendNow(storeId, id);
  }

  @Post(':id/cancel')
  async cancel(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.campaignsService.cancel(storeId, id);
  }

  @Get(':id/stats')
  async getStats(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.campaignsService.getStats(storeId, id);
  }

  @Post(':id/duplicate')
  async duplicate(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.campaignsService.duplicate(storeId, id);
  }
}
