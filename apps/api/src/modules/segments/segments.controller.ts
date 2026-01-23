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
import { SegmentsService } from './segments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SegmentDefinition } from '@appfy/shared';

interface CreateSegmentDto {
  name: string;
  description?: string;
  definition: SegmentDefinition;
}

interface UpdateSegmentDto {
  name?: string;
  description?: string;
  definition?: SegmentDefinition;
}

@Controller('segments')
@UseGuards(JwtAuthGuard)
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  async findAll(@Headers('x-store-id') storeId: string) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.segmentsService.findAll(storeId);
  }

  @Get(':id')
  async findOne(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.segmentsService.findOne(storeId, id);
  }

  @Post()
  async create(
    @Headers('x-store-id') storeId: string,
    @Body() dto: CreateSegmentDto,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.segmentsService.create(storeId, dto);
  }

  @Put(':id')
  async update(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSegmentDto,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.segmentsService.update(storeId, id, dto);
  }

  @Delete(':id')
  async delete(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.segmentsService.delete(storeId, id);
  }

  @Get(':id/members')
  async getMembers(
    @Headers('x-store-id') storeId: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.segmentsService.getMembers(
      storeId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('preview')
  async previewCount(
    @Headers('x-store-id') storeId: string,
    @Body() body: { definition: SegmentDefinition },
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.segmentsService.previewCount(storeId, body.definition);
  }
}
