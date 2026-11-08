import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../src/modules/identity-tenant/auth/guards/jwt-auth.guard';

function mockContext(cookies: Record<string, string> = {}): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ cookies }),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('allows a request through without checking cookies when the route is @Public()', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as unknown as Reflector;
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    await expect(guard.canActivate(mockContext())).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a protected route with no access_token cookie', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    await expect(guard.canActivate(mockContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a protected route with an invalid/expired token', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const jwtService = {
      verifyAsync: vi.fn().mockRejectedValue(new Error('jwt expired')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    await expect(guard.canActivate(mockContext({ access_token: 'stale' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the verified claims to the request and allows the call through', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const claims = { sub: 'user-1', email: 'a@b.com' };
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue(claims) } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, reflector);

    const request = { cookies: { access_token: 'valid' } } as unknown as {
      cookies: Record<string, string>;
      user?: unknown;
    };
    const context = {
      getHandler: () => vi.fn(),
      getClass: () => vi.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(claims);
  });
});
