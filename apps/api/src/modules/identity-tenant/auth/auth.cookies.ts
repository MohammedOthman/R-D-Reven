import type { FastifyReply } from 'fastify';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants';

export interface CookieOptions {
  domain?: string;
  secure: boolean;
}

function baseOptions({ domain, secure }: CookieOptions) {
  return {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    domain: domain || undefined,
  };
}

export function setAuthCookies(
  reply: FastifyReply,
  tokens: { accessToken: string; refreshToken: string },
  options: CookieOptions,
): void {
  reply.setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions(options),
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  reply.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions(options),
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearAuthCookies(reply: FastifyReply, options: CookieOptions): void {
  reply.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions(options));
  reply.clearCookie(REFRESH_TOKEN_COOKIE, baseOptions(options));
}
