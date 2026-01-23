import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AutomationFlow } from '@appfy/shared';

interface CreateAutomationDto {
  name: string;
  description?: string;
  trigger_event: string;
  flow: AutomationFlow;
  is_active?: boolean;
}

interface UpdateAutomationDto {
  name?: string;
  description?: string;
  trigger_event?: string;
  flow?: AutomationFlow;
  is_active?: boolean;
}

@Controller('automations')
@UseGuards(JwtAuthGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  async findAll(@Headers('x-store-id') storeId: string) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.automationsService.findAll(storeId);
  }

  @Get(':id')
  async findOne(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.automationsService.findOne(storeId, id);
  }

  @Post()
  async create(
    @Headers('x-store-id') storeId: string,
    @Body() dto: CreateAutomationDto,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.automationsService.create(storeId, dto);
  }

  @Put(':id')
  async update(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.automationsService.update(storeId, id, dto);
  }

  @Delete(':id')
  async delete(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.automationsService.delete(storeId, id);
  }

  @Patch(':id/toggle')
  async toggle(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
    @Body() body: { is_active: boolean },
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.automationsService.toggleActive(storeId, id, body.is_active);
  }

  @Get(':id/runs')
  async getRuns(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.automationsService.getRuns(
      storeId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':id/stats')
  async getStats(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.automationsService.getStats(storeId, id);
  }
}
