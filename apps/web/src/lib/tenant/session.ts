import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { TenantWithRole } from './types';

const API_URL = SERVER_API_URL;

/** Same forward-the-cookie pattern as `auth/session.ts`'s `getCurrentUser` — one implementation of "what does this session actually have access to," in the API. */
export async function getCurrentTenant(): Promise<TenantWithRole> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return { tenant: null, role: null };

  const res = await fetch(`${API_URL}/tenants/me`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });

  if (!res.ok) return { tenant: null, role: null };
  return (await res.json()) as TenantWithRole;
}
