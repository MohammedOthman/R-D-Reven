import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  refreshSession,
  startPilotSession,
  withReplacedCookie,
} from './src/lib/auth/silent-refresh';

const intlMiddleware = createMiddleware(routing);

// Set only on the separate pilot app: visitors with no session at all are
// signed in as the shared pilot user instead of seeing the sign-in page.
const PILOT_AUTO_LOGIN = process.env.PILOT_AUTO_LOGIN === 'true';

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
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const locale = routing.locales.find((value) => value === segments[0]) ?? routing.defaultLocale;
  const page = segments.at(-1);
  // The public home must remain available even when the pilot API is down.
  // Entering /workspace starts the pilot session through the existing flow.
  const isPublicHome =
    segments.length === 0 ||
    (segments.length === 1 && routing.locales.some((value) => value === segments[0]));
  if (isPublicHome) return intlMiddleware(request);
  // Recovery itself must not bootstrap a session, otherwise an unavailable
  // API would cause a redirect loop instead of showing the retry action.
  if (PILOT_AUTO_LOGIN && page === 'pilot-unavailable') return intlMiddleware(request);
  const pilotAccountPage =
    PILOT_AUTO_LOGIN &&
    [
      'sign-in',
      'sign-up',
      'forgot-password',
      'reset-password',
      'accept-invite',
      'create-organization',
      'administration',
    ].includes(page ?? '');
  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const savedPilotRole = request.cookies.get('pilot_role')?.value;
  const pilotRole =
    savedPilotRole && ['OWNER', 'EXECUTIVE', 'REVIEWER'].includes(savedPilotRole)
      ? savedPilotRole
      : undefined;

  if ((!pilotAccountPage && hasAccessToken) || (!refreshToken && !PILOT_AUTO_LOGIN)) {
    return intlMiddleware(request);
  }

  // In pilot mode, a refresh token that no longer works falls back to a
  // fresh pilot session rather than to the sign-in page.
  const refreshed =
    (refreshToken && !pilotAccountPage ? await refreshSession(refreshToken) : null) ??
    (PILOT_AUTO_LOGIN ? await startPilotSession(pilotRole) : null);
  if (!refreshed) {
    if (PILOT_AUTO_LOGIN)
      return NextResponse.redirect(new URL(`/${locale}/pilot-unavailable`, request.url));
    return intlMiddleware(request);
  }

  const requestWithFreshCookie = new NextRequest(request, {
    headers: withReplacedCookie(request.headers, ACCESS_TOKEN_COOKIE, refreshed.newAccessToken),
  });

  const response = pilotAccountPage
    ? NextResponse.redirect(new URL(`/${locale}/workspace`, request.url))
    : intlMiddleware(requestWithFreshCookie);
  for (const cookie of refreshed.setCookieHeaders) {
    response.headers.append('set-cookie', cookie);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
