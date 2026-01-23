import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Res,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { RemoteConfigService } from './remote-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ThemeConfig,
  AllowlistConfig,
  ModulesConfig,
  PushConfig,
  FeatureFlagsConfig,
} from './types/app-config.types';

interface UpdateConfigDto {
  modules?: Partial<ModulesConfig>;
  theme?: Partial<ThemeConfig>;
  allowlist?: Partial<AllowlistConfig>;
  push?: Partial<PushConfig>;
  features?: FeatureFlagsConfig;
}

@Controller('remote-config')
export class RemoteConfigController {
  constructor(private readonly remoteConfigService: RemoteConfigService) {}

  // ==================== PUBLIC ENDPOINTS (for mobile apps) ====================

  /**
   * Get remote config for an app (used by mobile SDK)
   * GET /v1/remote-config/:appId
   */
  @Get(':appId')
  async getConfig(
    @Param('appId') appId: string,
    @Headers('if-none-match') ifNoneMatch: string,
    @Res() res: Response,
  ) {
    const { envelope, etag } = await this.remoteConfigService.getConfig(appId);

    // Handle ETag for caching
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(HttpStatus.NOT_MODIFIED).send();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', `public, max-age=300`); // 5 minutes
    return res.json(envelope);
  }

  // ==================== CONSOLE ENDPOINTS (authenticated) ====================

  /**
   * Get draft config for editing
   * GET /v1/remote-config/apps/:appId/draft
   */
  @Get('apps/:appId/draft')
  @UseGuards(JwtAuthGuard)
  async getDraftConfig(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.getDraftConfig(storeId, appId);
  }

  /**
   * Update draft config
   * PUT /v1/remote-config/apps/:appId/draft
   */
  @Put('apps/:appId/draft')
  @UseGuards(JwtAuthGuard)
  async updateDraftConfig(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
    @Body() dto: UpdateConfigDto,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.updateDraftConfig(storeId, appId, dto);
  }

  /**
   * Publish config
   * POST /v1/remote-config/apps/:appId/publish
   */
  @Post('apps/:appId/publish')
  @UseGuards(JwtAuthGuard)
  async publishConfig(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.publishConfig(storeId, appId);
  }

  /**
   * Get version history
   * GET /v1/remote-config/apps/:appId/versions
   */
  @Get('apps/:appId/versions')
  @UseGuards(JwtAuthGuard)
  async getVersionHistory(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.getVersionHistory(storeId, appId);
  }

  /**
   * Rollback to a previous version
   * POST /v1/remote-config/apps/:appId/rollback/:versionId
   */
  @Post('apps/:appId/rollback/:versionId')
  @UseGuards(JwtAuthGuard)
  async rollbackToVersion(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
    @Param('versionId') versionId: string,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.rollbackToVersion(storeId, appId, versionId);
  }

  // ==================== CONVENIENCE ENDPOINTS ====================

  /**
   * Update only modules
   * PUT /v1/remote-config/apps/:appId/modules
   */
  @Put('apps/:appId/modules')
  @UseGuards(JwtAuthGuard)
  async updateModules(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
    @Body() modules: Partial<ModulesConfig>,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.updateDraftConfig(storeId, appId, { modules });
  }

  /**
   * Update only theme
   * PUT /v1/remote-config/apps/:appId/theme
   */
  @Put('apps/:appId/theme')
  @UseGuards(JwtAuthGuard)
  async updateTheme(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
    @Body() theme: Partial<ThemeConfig>,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.updateDraftConfig(storeId, appId, { theme });
  }

  /**
   * Update only allowlist
   * PUT /v1/remote-config/apps/:appId/allowlist
   */
  @Put('apps/:appId/allowlist')
  @UseGuards(JwtAuthGuard)
  async updateAllowlist(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
    @Body() allowlist: Partial<AllowlistConfig>,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.updateDraftConfig(storeId, appId, { allowlist });
  }

  /**
   * Update only push settings
   * PUT /v1/remote-config/apps/:appId/push
   */
  @Put('apps/:appId/push')
  @UseGuards(JwtAuthGuard)
  async updatePushSettings(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
    @Body() push: Partial<PushConfig>,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.updateDraftConfig(storeId, appId, { push });
  }

  /**
   * Update only feature flags
   * PUT /v1/remote-config/apps/:appId/features
   */
  @Put('apps/:appId/features')
  @UseGuards(JwtAuthGuard)
  async updateFeatures(
    @Headers('x-store-id') storeId: string,
    @Param('appId') appId: string,
    @Body() features: FeatureFlagsConfig,
  ) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }
    return this.remoteConfigService.updateDraftConfig(storeId, appId, { features });
  }
}
