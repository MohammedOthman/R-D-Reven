import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { DashboardResponse } from './types';

const API_URL = SERVER_API_URL;

export async function getDashboard(tenantId: string): Promise<DashboardResponse | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  const res = await fetch(`${API_URL}/tenants/${tenantId}/dashboard`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as DashboardResponse;
}
