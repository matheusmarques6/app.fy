import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppsService } from './apps.service';
import { KeypairService } from './keypair.service';
import { UpdateAppDto, SetupOneSignalDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface UserContext {
  userId: string;
  accountId: string;
  email: string;
  role: string;
}

@Controller('apps')
@UseGuards(AuthGuard('jwt'))
export class AppsController {
  constructor(
    private readonly appsService: AppsService,
    private readonly keypairService: KeypairService,
  ) {}

  /**
   * Get app by store ID
   * GET /v1/apps?store_id=xxx
   * Also supports X-Store-Id header
   */
  @Get()
  async findByStore(
    @Query('store_id') queryStoreId: string,
    @Headers('x-store-id') headerStoreId: string,
    @CurrentUser() user: UserContext,
  ) {
    const storeId = queryStoreId || headerStoreId;
    if (!storeId) {
      throw new BadRequestException('store_id query parameter or X-Store-Id header is required');
    }
    return this.appsService.findByStoreId(storeId, user.userId);
  }

  /**
   * Get app by ID
   * GET /v1/apps/:id
   */
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.appsService.findById(id, user.userId);
  }

  /**
   * Update app
   * PUT /v1/apps/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAppDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.appsService.update(id, user.userId, dto);
  }

  /**
   * Get app versions
   * GET /v1/apps/:id/versions
   */
  @Get(':id/versions')
  async getVersions(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.appsService.getVersions(id, user.userId);
  }

  /**
   * Generate new Remote Config keypair
   * POST /v1/apps/:id/generate-keypair
   */
  @Post(':id/generate-keypair')
  async generateKeypair(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access and get app
    const app = await this.appsService.findById(id, user.userId);

    // Generate new keypair
    const { publicKey, privateKeyRef } = await this.keypairService.generateKeypair(id);

    // Update app with new keypair
    await this.appsService.updateKeypair(id, publicKey, privateKeyRef);

    return {
      public_key: publicKey,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Setup OneSignal integration (manual)
   * POST /v1/apps/:id/onesignal
   */
  @Post(':id/onesignal')
  @HttpCode(HttpStatus.OK)
  async setupOneSignal(
    @Param('id') id: string,
    @Body() dto: SetupOneSignalDto,
    @CurrentUser() user: UserContext,
  ) {
    if (!dto.app_id || !dto.api_key) {
      throw new Error('app_id and api_key are required for manual setup');
    }

    await this.appsService.setupOneSignalManual(
      id,
      user.userId,
      dto.app_id,
      dto.api_key,
    );

    return {
      configured: true,
      app_id: dto.app_id,
    };
  }

  /**
   * Disconnect OneSignal
   * DELETE /v1/apps/:id/onesignal
   */
  @Delete(':id/onesignal')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnectOneSignal(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    await this.appsService.disconnectOneSignal(id, user.userId);
  }

  /**
   * Check build readiness
   * GET /v1/apps/:id/build-readiness
   */
  @Get(':id/build-readiness')
  async checkBuildReadiness(
    @Param('id') id: string,
    @Query('platform') platform: 'ios' | 'android',
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(id, user.userId);

    return this.appsService.checkBuildReadiness(id, platform);
  }
}
