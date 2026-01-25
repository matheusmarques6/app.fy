import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { AppsService } from '../apps/apps.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface UserContext {
  userId: string;
  accountId: string;
  email: string;
  role: string;
}

// 10MB max file size
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Controller('apps/:appId/assets')
@UseGuards(AuthGuard('jwt'))
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly appsService: AppsService,
  ) {}

  /**
   * Get assets info
   * GET /v1/apps/:appId/assets
   */
  @Get()
  async getAssets(
    @Param('appId') appId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    return this.assetsService.getAssets(appId);
  }

  /**
   * Upload app icon
   * POST /v1/apps/:appId/assets/icon
   */
  @Post('icon')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadIcon(
    @Param('appId') appId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserContext,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Verify edit access
    await this.appsService.findById(appId, user.userId);

    return this.assetsService.uploadIcon(appId, file.buffer);
  }

  /**
   * Upload splash screen
   * POST /v1/apps/:appId/assets/splash
   */
  @Post('splash')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadSplash(
    @Param('appId') appId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserContext,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Verify edit access
    await this.appsService.findById(appId, user.userId);

    return this.assetsService.uploadSplash(appId, file.buffer);
  }

  /**
   * Delete icon
   * DELETE /v1/apps/:appId/assets/icon
   */
  @Delete('icon')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteIcon(
    @Param('appId') appId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify edit access
    await this.appsService.findById(appId, user.userId);

    await this.assetsService.deleteIcon(appId);
  }

  /**
   * Delete splash
   * DELETE /v1/apps/:appId/assets/splash
   */
  @Delete('splash')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSplash(
    @Param('appId') appId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify edit access
    await this.appsService.findById(appId, user.userId);

    await this.assetsService.deleteSplash(appId);
  }

  /**
   * Get signed URL for icon preview
   * GET /v1/apps/:appId/assets/icon/url
   */
  @Get('icon/url')
  async getIconUrl(
    @Param('appId') appId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    const url = await this.assetsService.getSignedUrl(appId, 'icon');
    return { url };
  }

  /**
   * Get signed URL for splash preview
   * GET /v1/apps/:appId/assets/splash/url
   */
  @Get('splash/url')
  async getSplashUrl(
    @Param('appId') appId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    const url = await this.assetsService.getSignedUrl(appId, 'splash');
    return { url };
  }
}
