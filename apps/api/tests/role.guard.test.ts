import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { TenantsService } from '../src/modules/identity-tenant/tenants/tenants.service';
import { RoleGuard } from '../src/modules/identity-tenant/tenants/guards/role.guard';

function mockContext(
  params: Record<string, string>,
  user = { sub: 'user-1', email: 'a@b.com' },
): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ params, user }) }),
  } as unknown as ExecutionContext;
}

describe('RoleGuard', () => {
  it('allows any request through when the route declares no required roles', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const tenantsService = { membershipFor: vi.fn() } as unknown as TenantsService;
    const guard = new RoleGuard(reflector, tenantsService);

    await expect(guard.canActivate(mockContext({ tenantId: 't1' }))).resolves.toBe(true);
    expect(tenantsService.membershipFor).not.toHaveBeenCalled();
  });

  it('denies when the caller has no membership in the :tenantId route param', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['OWNER', 'ADMIN']),
    } as unknown as Reflector;
    const tenantsService = {
      membershipFor: vi.fn().mockResolvedValue(null),
    } as unknown as TenantsService;
    const guard = new RoleGuard(reflector, tenantsService);

    await expect(guard.canActivate(mockContext({ tenantId: 't1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies when the membership exists but the role is not in the allow-list', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['OWNER', 'ADMIN']),
    } as unknown as Reflector;
    const tenantsService = {
      membershipFor: vi.fn().mockResolvedValue({ role: 'MANAGER', status: 'ACTIVE' }),
    } as unknown as TenantsService;
    const guard = new RoleGuard(reflector, tenantsService);

    await expect(guard.canActivate(mockContext({ tenantId: 't1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies a suspended member even if their role is in the allow-list', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['OWNER', 'ADMIN']),
    } as unknown as Reflector;
    const tenantsService = {
      membershipFor: vi.fn().mockResolvedValue({ role: 'ADMIN', status: 'SUSPENDED' }),
    } as unknown as TenantsService;
    const guard = new RoleGuard(reflector, tenantsService);

    await expect(guard.canActivate(mockContext({ tenantId: 't1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows and attaches the membership when the role is permitted', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['OWNER', 'ADMIN']),
    } as unknown as Reflector;
    const membership = { role: 'OWNER', status: 'ACTIVE' };
    const tenantsService = {
      membershipFor: vi.fn().mockResolvedValue(membership),
    } as unknown as TenantsService;
    const guard = new RoleGuard(reflector, tenantsService);

    const request: { params: Record<string, string>; user: unknown; membership?: unknown } = {
      params: { tenantId: 't1' },
      user: { sub: 'user-1' },
    };
    const context = {
      getHandler: () => vi.fn(),
      getClass: () => vi.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.membership).toBe(membership);
  });

  it('denies when there is no :tenantId route param at all', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['OWNER']),
    } as unknown as Reflector;
    const tenantsService = { membershipFor: vi.fn() } as unknown as TenantsService;
    const guard = new RoleGuard(reflector, tenantsService);

    await expect(guard.canActivate(mockContext({}))).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenantsService.membershipFor).not.toHaveBeenCalled();
  });
});
