import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { routing } from './src/i18n/routing';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  refreshSession,
  withReplacedCookie,
} from './src/lib/auth/silent-refresh';

const intlMiddleware = createMiddleware(routing);

/**
 * Silent session renewal. The access token cookie is short-lived (15 min,
 * see apps/api's auth.constants.ts) and nothing else in this app ever calls
 * `/auth/refresh` on its own — without this, every session would simply stop
 * working 15 minutes after sign-in even though the refresh token (30 days)
 * is still valid. This runs before every page request: if the access token
 * cookie has expired off the request (the browser stops sending it once past
 * its Max-Age) but a refresh token is still present, it exchanges it for a
 * fresh pair server-to-server, rewrites the *current* request so this same
 * render sees a valid session, and forwards the new cookies to the browser.
 * See `src/lib/api/client.ts`'s `apiFetch` for the equivalent fix on the
 * client side — a form submission never goes through this proxy at all.
 */
export default async function proxy(request: NextRequest) {
  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (hasAccessToken || !refreshToken) {
    return intlMiddleware(request);
  }

  const refreshed = await refreshSession(refreshToken);
  if (!refreshed) {
    return intlMiddleware(request);
  }

  const requestWithFreshCookie = new NextRequest(request, {
    headers: withReplacedCookie(request.headers, ACCESS_TOKEN_COOKIE, refreshed.newAccessToken),
  });

  const response = intlMiddleware(requestWithFreshCookie);
  for (const cookie of refreshed.setCookieHeaders) {
    response.headers.append('set-cookie', cookie);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
