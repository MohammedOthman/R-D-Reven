import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';
import type { JwtPayload } from '../jwt-payload.type';

/**
 * Global guard — deny by default (PRD §2.2). Every route requires a valid
 * `access_token` cookie unless marked `@Public()`. Reads the cookie rather
 * than an Authorization header since the browser sends it automatically on
 * same-site requests (see docs/DECISIONS.md for the cookie/CORS setup).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: JwtPayload }>();
    const token = request.cookies[ACCESS_TOKEN_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Not signed in.');
    }

    try {
      request.user = await this.jwtService.verifyAsync<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Session expired or invalid.');
    }
  }
}
