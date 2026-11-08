import 'server-only';
import { cookies } from 'next/headers';
import type { Partnership } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Only called after the page has already confirmed read access via `getCurrentTenant()`'s role. */
export async function getPartnerships(tenantId: string): Promise<Partnership[]> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return [];

  const res = await fetch(`${API_URL}/tenants/${tenantId}/partnerships`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const { partnerships } = (await res.json()) as { partnerships: Partnership[] };
  return partnerships;
}
