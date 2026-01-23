import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    // Try human token first, then device token
    let claims = await this.authService.validateHumanToken(token);

    if (!claims) {
      const deviceClaims = await this.authService.validateDeviceToken(token);
      if (deviceClaims) {
        request.user = {
          ...deviceClaims,
          type: 'device',
        };
        return true;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = {
      ...claims,
      type: 'human',
    };

    return true;
  }
}
