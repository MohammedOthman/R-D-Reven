import {
  ForbiddenException,
  Injectable,
  Logger,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { Membership, MembershipRole } from '@revn/db';
import { TenantsService } from '../tenants.service';
import { REQUIRED_ROLES_KEY } from '../decorators/require-role.decorator';
import type { JwtPayload } from '../../auth/jwt-payload.type';

/**
 * Runs after `JwtAuthGuard` on any route carrying `@RequireRole(...)`. Looks
 * up the caller's membership in the `:tenantId` route param — not just "the
 * caller's own tenant" — so this doubles as tenant-isolation enforcement
 * (PRD AUTH-01): a user with no membership in that specific tenant is denied
 * the same way as one with the wrong role, since `membershipFor` returns
 * null either way.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantsService: TenantsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      FastifyRequest<{ Params: { tenantId?: string } }> & {
        user: JwtPayload;
        membership?: Membership;
      }
    >();
    const tenantId = request.params.tenantId;

    const membership = tenantId
      ? await this.tenantsService.membershipFor(tenantId, request.user.sub)
      : null;
    const allowed =
      !!membership && membership.status === 'ACTIVE' && requiredRoles.includes(membership.role);

    if (!allowed) {
      // PRD AUTH-05: denied actions get security telemetry, without leaking
      // whether the tenant/object exists to a caller who has no access to it.
      this.logger.warn(
        `Denied: user=${request.user.sub} tenant=${tenantId ?? '(none)'} route=${request.method} ${request.url} ` +
          `requiredRoles=${requiredRoles.join(',')} actualRole=${membership?.role ?? '(none)'}`,
      );
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    request.membership = membership;
    return true;
  }
}
