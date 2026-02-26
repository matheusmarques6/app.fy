import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import * as jose from 'jose';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    // 1. Try custom human token (legacy console JWT)
    const humanClaims = await this.authService.validateHumanToken(token);
    if (humanClaims) {
      request.user = {
        userId: humanClaims.user_id,
        email: humanClaims.email,
        accountId: humanClaims.account_id,
        role: humanClaims.role,
        type: 'human',
      };
      return true;
    }

    // 2. Try Supabase JWT (new console auth via Supabase Auth)
    const supabaseClaims = await this.validateSupabaseToken(token);
    if (supabaseClaims) {
      request.user = {
        userId: supabaseClaims.sub,
        email: supabaseClaims.email,
        accountId: supabaseClaims.account_id,
        role: supabaseClaims.role,
        type: 'human',
      };
      return true;
    }

    // 3. Try device token (mobile app)
    const deviceClaims = await this.authService.validateDeviceToken(token);
    if (deviceClaims) {
      request.user = { ...deviceClaims, type: 'device' };
      return true;
    }

    throw new UnauthorizedException('Invalid or expired token');
  }

  private async validateSupabaseToken(token: string) {
    const secret = this.configService.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) return null;

    try {
      const secretKey = new TextEncoder().encode(secret);
      const { payload } = await jose.jwtVerify(token, secretKey, {
        audience: 'authenticated',
      });

      if (!payload.sub || !payload.email) return null;

      // Find or auto-provision user in our DB
      let user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          account_memberships: {
            include: { account: true },
            take: 1,
          },
        },
      });

      if (!user) {
        const metadata = (payload.user_metadata ?? {}) as Record<string, string>;
        // Use upsert to avoid race condition on concurrent first requests
        user = await this.prisma.user.upsert({
          where: { id: payload.sub },
          create: {
            id: payload.sub,
            email: payload.email as string,
            name: metadata.name ?? null,
            auth_provider: 'supabase',
            email_verified: true,
          },
          update: {},
          include: {
            account_memberships: {
              include: { account: true },
              take: 1,
            },
          },
        });
      }

      const membership = user.account_memberships[0];

      return {
        sub: user.id,
        email: user.email,
        account_id: membership?.account_id ?? null,
        role: membership?.role ?? 'viewer',
        typ: 'user_access' as const,
      };
    } catch {
      return null;
    }
  }
}
