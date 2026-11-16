// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type * as SessionHelpers from '@/src/lib/auth/silent-refresh';

const { refresh, pilot, intl } = vi.hoisted(() => ({
  refresh: vi.fn(),
  pilot: vi.fn(),
  intl: vi.fn(),
}));
vi.mock('next-intl/middleware', () => ({ default: () => intl }));
vi.mock('@/src/lib/auth/silent-refresh', async (original) => ({
  ...(await original<typeof SessionHelpers>()),
  refreshSession: refresh,
  startPilotSession: pilot,
}));

async function run(path = '/en/workspace', cookie?: string) {
  const { default: proxy } = await import('../proxy');
  return proxy(
    new NextRequest(`https://pilot.example${path}`, { headers: cookie ? { cookie } : {} }),
  );
}
const session = {
  newAccessToken: 'fresh',
  setCookieHeaders: [
    'access_token=fresh; Path=/; HttpOnly',
    'refresh_token=rotated; Path=/; HttpOnly',
  ],
};

describe('pilot entry and recovery', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PILOT_AUTO_LOGIN', 'true');
    vi.clearAllMocks();
    refresh.mockResolvedValue(null);
    pilot.mockResolvedValue(session);
    intl.mockImplementation(() => NextResponse.next());
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(['/', '/en', '/ar'])(
    'keeps %s public without minting or refreshing sessions',
    async (path) => {
      pilot.mockResolvedValue(null);
      const response = await run(path, 'refresh_token=expired');
      expect(pilot).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
      expect(response.headers.get('location')).toBeNull();
    },
  );
  it('opens a workspace for a visitor with no cookies, including the first render', async () => {
    const response = await run();
    expect(pilot).toHaveBeenCalledOnce();
    expect(intl.mock.calls[0]?.[0].cookies.get('access_token')?.value).toBe('fresh');
    expect(response.headers.getSetCookie()).toEqual(session.setCookieHeaders);
  });
  it('uses the current access session without minting more tokens', async () => {
    await run('/en/partnerships', 'access_token=present');
    expect(pilot).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
  it('rejoins the pilot when the refresh token is no longer valid', async () => {
    await run('/en/reviews', 'refresh_token=expired');
    expect(refresh).toHaveBeenCalledWith('expired');
    expect(pilot).toHaveBeenCalledOnce();
  });
  it('keeps the selected persona when rejoining the pilot', async () => {
    await run('/en/evidence-outcomes', 'refresh_token=expired; pilot_role=REVIEWER');
    expect(pilot).toHaveBeenCalledWith('REVIEWER');
  });
  it('ignores an invalid saved persona instead of trapping the visitor on recovery', async () => {
    await run('/en/workspace', 'pilot_role=ADMIN');
    expect(pilot).toHaveBeenCalledWith(undefined);
  });
  it.each([
    'sign-in',
    'sign-up',
    'forgot-password',
    'reset-password',
    'accept-invite',
    'create-organization',
    'administration',
  ])('keeps %s out of the pilot journey, even with stale access cookies', async (page) => {
    const response = await run(`/ar/${page}`, 'access_token=invalid; refresh_token=old');
    expect(response.headers.get('location')).toBe('https://pilot.example/ar/workspace');
    expect(pilot).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual(session.setCookieHeaders);
  });
  it('shows a retry page when the API is unavailable instead of a login form', async () => {
    pilot.mockResolvedValue(null);
    const response = await run('/ar/workspace');
    expect(response.headers.get('location')).toBe('https://pilot.example/ar/pilot-unavailable');
  });
  it('does not redirect the retry page back to itself', async () => {
    pilot.mockResolvedValue(null);
    const response = await run('/en/pilot-unavailable');
    expect(response.headers.get('location')).toBeNull();
    expect(pilot).not.toHaveBeenCalled();
  });
  it('preserves normal authentication when pilot mode is disabled', async () => {
    vi.stubEnv('PILOT_AUTO_LOGIN', 'false');
    await run('/en/sign-in');
    expect(pilot).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
