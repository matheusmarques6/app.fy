import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDeviceDto, RefreshTokenDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a device and get tokens
   * POST /v1/auth/devices/register
   */
  @Post('devices/register')
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @HttpCode(HttpStatus.OK)
  async registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.authService.registerDevice(dto);
  }

  /**
   * Refresh device tokens
   * POST /v1/auth/token/refresh
   */
  @Post('token/refresh')
  @Throttle({ short: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshDeviceToken(dto.refresh_token);
  }
}
