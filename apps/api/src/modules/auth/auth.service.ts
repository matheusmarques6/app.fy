// @ts-nocheck
import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_TTL,
  JWT_AUDIENCE_DEVICE,
  JWT_AUDIENCE_USER,
  JWT_ISSUER,
} from '@appfy/shared';
import type {
  DeviceRegisterRequest,
  DeviceRegisterResponse,
  DeviceTokenClaims,
} from '@appfy/shared';

interface HumanTokenClaims {
  iss?: string;
  aud: string;
  typ: 'user_access';
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  user_id: string;
  account_id: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Register a new device and issue tokens
   */
  async registerDevice(dto: DeviceRegisterRequest): Promise<DeviceRegisterResponse> {
    // Verify store and app exist
    const app = await this.prisma.app.findFirst({
      where: {
        id: dto.app_id,
        store_id: dto.store_id,
      },
      include: { store: true },
    });

    if (!app) {
      throw new UnauthorizedException('Invalid app_id or store_id');
    }

    // Check if device already exists
    let device = await this.prisma.device.findFirst({
      where: {
        store_id: dto.store_id,
        device_fingerprint: dto.device_fingerprint,
      },
    });

    const now = new Date();

    if (device) {
      // Update existing device
      device = await this.prisma.device.update({
        where: { id: device.id },
        data: {
          locale: dto.locale,
          timezone: dto.timezone,
          country_guess: dto.country_guess,
          last_seen_at: now,
        },
      });
    } else {
      // Create new device
      device = await this.prisma.device.create({
        data: {
          store_id: dto.store_id,
          app_id: dto.app_id,
          device_fingerprint: dto.device_fingerprint,
          platform: dto.platform,
          locale: dto.locale,
          timezone: dto.timezone,
          country_guess: dto.country_guess,
          last_seen_at: now,
        },
      });
    }

    // Handle OneSignal subscription
    if (dto.onesignal?.provider_sub_id) {
      await this.prisma.pushSubscription.upsert({
        where: {
          device_id_provider: {
            device_id: device.id,
            provider: 'onesignal',
          },
        },
        create: {
          device_id: device.id,
          store_id: dto.store_id,
          provider: 'onesignal',
          provider_sub_id: dto.onesignal.provider_sub_id,
          opt_in: true,
          opt_in_at: now,
        },
        update: {
          provider_sub_id: dto.onesignal.provider_sub_id,
        },
      });
    }

    // Create session and tokens
    const familyId = randomUUID();
    const { accessToken, refreshToken } = await this.createDeviceTokens(
      device.id,
      dto.store_id,
      dto.app_id,
      familyId,
    );

    return {
      device_id: device.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      server_time: now.toISOString(),
    };
  }

  /**
   * Refresh device tokens
   */
  async refreshDeviceToken(
    refreshToken: string,
  ): Promise<{ access_token: string; refresh_token: string; server_time: string }> {
    // Decode and verify refresh token
    let payload: DeviceTokenClaims;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if ((payload as any).typ !== 'device_refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check for reuse (rotation detection)
    const storedHash = await this.redis.getRefreshTokenHash(
      payload.device_id,
      payload.session_id || '',
    );
    const currentHash = this.hashToken(refreshToken);

    if (storedHash && storedHash !== currentHash) {
      // REFRESH REUSE DETECTED - revoke entire family
      this.logger.warn(
        `Refresh token reuse detected for device ${payload.device_id}`,
      );
      await this.redis.incrementMetric(
        'auth.refresh_reuse_detected',
        payload.store_id,
      );

      // Denylist the old token
      await this.redis.denylistToken(payload.jti, JWT_REFRESH_TOKEN_TTL);

      throw new UnauthorizedException('Token reuse detected');
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } =
      await this.createDeviceTokens(
        payload.device_id,
        payload.store_id,
        payload.app_id,
        payload.session_id || randomUUID(),
      );

    // Invalidate old refresh token
    await this.redis.denylistToken(payload.jti, JWT_REFRESH_TOKEN_TTL);

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      server_time: new Date().toISOString(),
    };
  }

  /**
   * Validate device token and return claims
   */
  async validateDeviceToken(token: string): Promise<DeviceTokenClaims | null> {
    try {
      const payload = this.jwtService.verify<DeviceTokenClaims>(token);

      // Check if token is denylisted
      if (await this.redis.isTokenDenylisted(payload.jti)) {
        return null;
      }

      // Validate claims
      if (payload.typ !== 'device_access') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Create device access and refresh tokens
   */
  private async createDeviceTokens(
    deviceId: string,
    storeId: string,
    appId: string,
    familyId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const now = Math.floor(Date.now() / 1000);
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessToken = this.jwtService.sign({
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE_DEVICE,
      typ: 'device_access',
      sub: deviceId,
      jti: accessJti,
      iat: now,
      exp: now + JWT_ACCESS_TOKEN_TTL,
      store_id: storeId,
      app_id: appId,
      device_id: deviceId,
      session_id: familyId,
    });

    const refreshToken = this.jwtService.sign({
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE_DEVICE,
      typ: 'device_refresh',
      sub: deviceId,
      jti: refreshJti,
      iat: now,
      exp: now + JWT_REFRESH_TOKEN_TTL,
      store_id: storeId,
      app_id: appId,
      device_id: deviceId,
      session_id: familyId,
    });

    // Store refresh token hash for rotation detection
    const refreshHash = this.hashToken(refreshToken);
    await this.redis.setRefreshTokenHash(
      deviceId,
      familyId,
      refreshHash,
      JWT_REFRESH_TOKEN_TTL,
    );

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // ==================== HUMAN (Console) AUTH ====================

  /**
   * Login a human user (for Console)
   */
  async loginHuman(
    email: string,
    password: string,
  ): Promise<{ access_token: string; user: any }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        account_memberships: {
          include: { account: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Get primary account membership
    const membership = user.account_memberships[0];
    if (!membership) {
      throw new UnauthorizedException('User has no account');
    }

    // Create human access token
    const accessToken = await this.createHumanToken({
      ...user,
      account_id: membership.account_id,
      role: membership.role,
    });

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        account_id: membership.account_id,
        role: membership.role,
      },
    };
  }

  /**
   * Register a new human user (for Console)
   */
  async registerHuman(
    email: string,
    password: string,
    name: string,
  ): Promise<{ access_token: string; user: any }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    // Create account and user in a transaction
    const result = await this.prisma.$transaction(async (tx: typeof this.prisma) => {
      // Generate unique slug from name
      const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      // Create account
      const account = await tx.account.create({
        data: {
          name: `${name}'s Account`,
          slug,
          plan: 'free',
        },
      });

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          password_hash: passwordHash,
        },
      });

      // Create account membership (links user to account with role)
      await tx.accountMembership.create({
        data: {
          account_id: account.id,
          user_id: user.id,
          role: 'owner',
        },
      });

      return { account, user };
    });

    // Create human access token
    const accessToken = await this.createHumanToken({
      ...result.user,
      account_id: result.account.id,
      role: 'owner',
    });

    return {
      access_token: accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        account_id: result.account.id,
        role: 'owner',
      },
    };
  }

  /**
   * Validate human token and return claims
   */
  async validateHumanToken(token: string): Promise<HumanTokenClaims | null> {
    try {
      const payload = this.jwtService.verify<HumanTokenClaims>(token);

      if (payload.typ !== 'user_access') {
        return null;
      }

      // Check if token is denylisted
      if (await this.redis.isTokenDenylisted(payload.jti)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Get current user profile
   */
  async getHumanProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        account_memberships: {
          include: { account: true },
          take: 1,
        },
        store_memberships: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
                primary_domain: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const membership = user.account_memberships[0];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership?.role || 'viewer',
      account: membership ? {
        id: membership.account.id,
        name: membership.account.name,
        plan: membership.account.plan,
      } : null,
      stores: user.store_memberships.map((m: any) => ({
        id: m.store.id,
        name: m.store.name,
        primary_domain: m.store.primary_domain,
        role: m.role,
      })),
    };
  }

  /**
   * Create human access token
   */
  private async createHumanToken(user: any): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const jti = randomUUID();

    // Human tokens last longer (1 hour)
    const humanTokenTtl = 60 * 60;

    return this.jwtService.sign({
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE_USER,
      typ: 'user_access',
      sub: user.id,
      jti,
      iat: now,
      exp: now + humanTokenTtl,
      user_id: user.id,
      account_id: user.account_id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }

  // ==================== PASSWORD RESET ====================

  /**
   * Request password reset - generates token and logs reset link
   * TODO: Send email when email service is configured
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      this.logger.log(`Password reset requested for non-existent email: ${email}`);
      return { message: 'If an account exists with this email, you will receive a password reset link.' };
    }

    // Generate secure token
    const resetToken = randomUUID();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Hash the token before storing (so it's not exposed if DB is compromised)
    const hashedToken = createHash('sha256').update(resetToken).digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_reset_token: hashedToken,
        password_reset_expires: resetExpires,
      },
    });

    // Build reset URL
    const consoleUrl = this.configService.get<string>('CONSOLE_BASE_URL', 'http://localhost:3001');
    const resetUrl = `${consoleUrl}/reset-password?token=${resetToken}`;

    // Log the reset link (for development/debugging)
    // TODO: Replace with actual email sending
    this.logger.log(`PASSWORD_RESET_URL email=${email} url=${resetUrl}`);

    return { message: 'If an account exists with this email, you will receive a password reset link.' };
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        password_reset_token: hashedToken,
        password_reset_expires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        password_reset_token: null,
        password_reset_expires: null,
      },
    });

    this.logger.log(`Password reset successful for user: ${user.email}`);

    return { message: 'Password has been reset successfully. You can now login with your new password.' };
  }
}
