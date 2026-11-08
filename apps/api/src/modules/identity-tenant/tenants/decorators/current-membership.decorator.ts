import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Membership } from '@revn/db';

/**
 * The caller's resolved membership for the `:tenantId` route param,
 * attached by `RoleGuard` after it passes. Only meaningful on a route
 * carrying `@RequireRole(...)` — every such route resolves a membership by
 * definition, so this is never null there in practice, but the type stays
 * honest about the guard being what populates it.
 */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Membership | undefined => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest & { membership?: Membership }>();
    return request.membership;
  },
);
