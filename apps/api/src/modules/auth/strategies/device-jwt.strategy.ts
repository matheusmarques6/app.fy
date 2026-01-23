import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/redis/redis.service';
import type { DeviceTokenClaims } from '@appfy/shared';
import { JWT_AUDIENCE_DEVICE, JWT_ISSUER } from '@appfy/shared';

@Injectable()
export class DeviceJwtStrategy extends PassportStrategy(Strategy, 'device-jwt') {
  constructor(
    configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_DEVICE,
    });
  }

  async validate(payload: DeviceTokenClaims) {
    if (payload.typ !== 'device_access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if token is denylisted
    if (await this.redis.isTokenDenylisted(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      deviceId: payload.device_id,
      storeId: payload.store_id,
      appId: payload.app_id,
      sessionId: payload.session_id,
    };
  }
}
