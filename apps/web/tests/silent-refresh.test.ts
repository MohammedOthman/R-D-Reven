import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cookieValueFrom, withReplacedCookie, refreshSession } from '@/src/lib/auth/silent-refresh';

describe('cookieValueFrom', () => {
  it('extracts a named cookie value from a list of Set-Cookie headers', () => {
    const headers = [
      'access_token=abc123; Path=/; HttpOnly',
      'refresh_token=xyz789; Path=/; HttpOnly',
    ];
    expect(cookieValueFrom(headers, 'access_token')).toBe('abc123');
    expect(cookieValueFrom(headers, 'refresh_token')).toBe('xyz789');
  });

  it('returns null when the named cookie is absent', () => {
    expect(cookieValueFrom(['refresh_token=xyz789'], 'access_token')).toBeNull();
  });
});

describe('withReplacedCookie', () => {
  it('replaces an existing cookie value while keeping the others', () => {
    const headers = new Headers({ cookie: 'access_token=old; refresh_token=keep-me' });
    const result = withReplacedCookie(headers, 'access_token', 'new');
    expect(result.get('cookie')).toBe('refresh_token=keep-me; access_token=new');
  });

  it('adds the cookie when it was not already present', () => {
    const headers = new Headers({ cookie: 'refresh_token=keep-me' });
    const result = withReplacedCookie(headers, 'access_token', 'new');
    expect(result.get('cookie')).toBe('refresh_token=keep-me; access_token=new');
  });

  it('does not mutate the original Headers object', () => {
    const headers = new Headers({ cookie: 'access_token=old' });
    withReplacedCookie(headers, 'access_token', 'new');
    expect(headers.get('cookie')).toBe('access_token=old');
  });
});

describe('refreshSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the new access token and cookies on a successful refresh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          getSetCookie: () => ['access_token=fresh; Path=/', 'refresh_token=rotated; Path=/'],
        },
      }),
    );

    const result = await refreshSession('old-refresh-token');

    expect(result).toEqual({
      newAccessToken: 'fresh',
      setCookieHeaders: ['access_token=fresh; Path=/', 'refresh_token=rotated; Path=/'],
    });
  });

  it('returns null when the API rejects the refresh token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await refreshSession('expired-or-revoked')).toBeNull();
  });

  it('returns null when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));
    expect(await refreshSession('whatever')).toBeNull();
  });
});
