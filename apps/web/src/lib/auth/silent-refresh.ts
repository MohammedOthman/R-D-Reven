// Not `server-only` guarded — this is plain fetch/Headers logic with no
// Node-only or Next.js-server-only APIs, only ever imported from `proxy.ts`
// (and this file's own tests). `proxy.ts` is what actually runs server-side.
import { SERVER_API_URL } from '../api/server-url';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const API_URL = SERVER_API_URL;

export interface RefreshResult {
  newAccessToken: string;
  setCookieHeaders: string[];
}

/** Exchanges a refresh token for a fresh session via the API. Never throws — a failure just means "treat this as unauthenticated," which is the correct fallback for every caller. */
export async function refreshSession(refreshToken: string): Promise<RefreshResult | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
    });
    if (!res.ok) return null;

    const setCookieHeaders = res.headers.getSetCookie();
    const newAccessToken = cookieValueFrom(setCookieHeaders, ACCESS_TOKEN_COOKIE);
    if (!newAccessToken) return null;

    return { newAccessToken, setCookieHeaders };
  } catch {
    return null;
  }
}

/**
 * Pilot mode only: signs the visitor in as the shared pilot user. The API
 * answers 404 unless PILOT_AUTO_LOGIN=true there, so on production this
 * just returns null. Never throws, for the same reason as `refreshSession`.
 */
export async function startPilotSession(): Promise<RefreshResult | null> {
  try {
    const res = await fetch(`${API_URL}/auth/pilot-session`, { method: 'POST' });
    if (!res.ok) return null;

    const setCookieHeaders = res.headers.getSetCookie();
    const newAccessToken = cookieValueFrom(setCookieHeaders, ACCESS_TOKEN_COOKIE);
    if (!newAccessToken) return null;

    return { newAccessToken, setCookieHeaders };
  } catch {
    return null;
  }
}

export function cookieValueFrom(setCookieHeaders: string[], name: string): string | null {
  for (const header of setCookieHeaders) {
    const match = header.match(new RegExp(`^${name}=([^;]+)`));
    if (match?.[1]) return match[1];
  }
  return null;
}

/** Rewrites a request's `Cookie` header so a request already in flight sees a just-refreshed value, without waiting for the browser's next request. */
export function withReplacedCookie(headers: Headers, name: string, value: string): Headers {
  const next = new Headers(headers);
  const pairs = (next.get('cookie') ?? '')
    .split('; ')
    .filter((pair) => pair && !pair.startsWith(`${name}=`));
  pairs.push(`${name}=${value}`);
  next.set('cookie', pairs.join('; '));
  return next;
}
