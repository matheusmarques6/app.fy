import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface UserContext {
  userId: string;
  accountId: string;
  email: string;
  role: string;
}

@Controller('stores')
@UseGuards(JwtAuthGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  /**
   * Create a new store
   * POST /v1/stores
   */
  @Post()
  async create(
    @Body() dto: CreateStoreDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.storesService.create(user.accountId, user.userId, dto);
  }

  /**
   * Get all stores for current user
   * GET /v1/stores
   */
  @Get()
  async findAll(@CurrentUser() user: UserContext) {
    return this.storesService.findAllForUser(user.userId);
  }

  /**
   * Get store by ID
   * GET /v1/stores/:id
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.storesService.findById(id, user.userId);
  }

  /**
   * Get store statistics
   * GET /v1/stores/:id/stats
   */
  @Get(':id/stats')
  async getStats(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access first
    await this.storesService.findById(id, user.userId);
    return this.storesService.getStats(id);
  }

  /**
   * Update store
   * PUT /v1/stores/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.storesService.update(id, user.userId, dto);
  }

  /**
   * Delete store
   * DELETE /v1/stores/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.storesService.delete(id, user.userId);
  }
}
