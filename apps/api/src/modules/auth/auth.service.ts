import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { createHash, randomUUID } from 'crypto';
import {
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_TTL,
  JWT_ISSUER,
  JWT_AUDIENCE_DEVICE,
  JWT_AUDIENCE_USER,
} from '@appfy/shared';
import type {
  DeviceRegisterRequest,
  DeviceRegisterResponse,
  DeviceTokenClaims,
} from '@appfy/shared';

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

    if (payload.typ !== 'device_refresh') {
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

    const accessToken = this.jwtService.sign(
      {
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
      } as DeviceTokenClaims,
    );

    const refreshToken = this.jwtService.sign(
      {
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
      },
    );

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
}
