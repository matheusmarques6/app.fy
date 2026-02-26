import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BuildsService } from './builds.service';
import { AppsService } from '../apps/apps.service';
import { CreateBuildDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface UserContext {
  userId: string;
  accountId: string;
  email: string;
  role: string;
}

@Controller('apps/:appId/builds')
@UseGuards(JwtAuthGuard)
export class BuildsController {
  constructor(
    private readonly buildsService: BuildsService,
    private readonly appsService: AppsService,
  ) {}

  /**
   * Create a new build
   * POST /v1/apps/:appId/builds
   */
  @Post()
  async create(
    @Param('appId') appId: string,
    @Body() dto: CreateBuildDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.buildsService.create(appId, user.userId, dto);
  }

  /**
   * List builds
   * GET /v1/apps/:appId/builds
   */
  @Get()
  async list(
    @Param('appId') appId: string,
    @Query('platform') platform: 'ios' | 'android' | undefined,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    return this.buildsService.list(appId, platform);
  }

  /**
   * Get build details
   * GET /v1/apps/:appId/builds/:buildId
   */
  @Get(':buildId')
  async findById(
    @Param('appId') appId: string,
    @Param('buildId') buildId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    return this.buildsService.findById(appId, buildId);
  }

  /**
   * Get build logs
   * GET /v1/apps/:appId/builds/:buildId/logs
   */
  @Get(':buildId/logs')
  async getLogs(
    @Param('appId') appId: string,
    @Param('buildId') buildId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    const logs = await this.buildsService.getLogs(appId, buildId);
    return { logs };
  }

  /**
   * Get download URL for build artifact
   * GET /v1/apps/:appId/builds/:buildId/download
   */
  @Get(':buildId/download')
  async getDownloadUrl(
    @Param('appId') appId: string,
    @Param('buildId') buildId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    const url = await this.buildsService.getDownloadUrl(appId, buildId);
    return { url };
  }

  /**
   * Cancel a build
   * DELETE /v1/apps/:appId/builds/:buildId
   */
  @Delete(':buildId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @Param('appId') appId: string,
    @Param('buildId') buildId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    await this.buildsService.cancel(appId, buildId);
  }
}
