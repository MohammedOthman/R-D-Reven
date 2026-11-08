import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { AuthUser } from './types';

const API_URL = SERVER_API_URL;

/**
 * Server-side session check — forwards the incoming request's cookies to the
 * API's `/auth/me` rather than verifying the JWT locally, so token
 * verification has exactly one implementation (the API's) instead of two
 * that could drift apart.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });

  if (!res.ok) return null;
  const { user } = (await res.json()) as { user: AuthUser };
  return user;
}
