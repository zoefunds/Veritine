import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export const SESSION_COOKIE_NAME = 'veritine_session';

/** Attaches the resolved User to req.user, or throws 401. */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }
    const user = await this.authService.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException('Session is invalid or has expired');
    }
    request.user = user;
    return true;
  }
}
