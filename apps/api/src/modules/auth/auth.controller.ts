import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDeviceDto, RefreshTokenDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==================== DEVICE AUTH ====================

  /**
   * Register a device and get tokens
   * POST /v1/auth/devices/register
   */
  @Post('devices/register')
  @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @HttpCode(HttpStatus.OK)
  async registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.authService.registerDevice(dto as any);
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

  // ==================== HUMAN (Console) AUTH ====================

  /**
   * Login a human user
   * POST /v1/auth/login
   */
  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.loginHuman(body.email, body.password);
  }

  /**
   * Register a new human user
   * POST /v1/auth/register
   */
  @Post('register')
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 registrations per minute
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: { email: string; password: string; name: string }) {
    return this.authService.registerHuman(body.email, body.password, body.name);
  }

  /**
   * Get current user profile
   * GET /v1/auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: any) {
    return this.authService.getHumanProfile(req.user.user_id);
  }
}
