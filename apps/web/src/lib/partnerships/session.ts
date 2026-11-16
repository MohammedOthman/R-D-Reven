import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { Partnership } from './types';

const API_URL = SERVER_API_URL;

/** Only called after the page has already confirmed read access via `getCurrentTenant()`'s role. */
export async function getPartnerships(
  tenantId: string,
  options: { failOnError?: boolean } = {},
): Promise<Partnership[]> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    if (options.failOnError) throw new Error('Portfolio session is unavailable.');
    return [];
  }

  const res = await fetch(`${API_URL}/tenants/${tenantId}/partnerships`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) {
    if (options.failOnError) throw new Error('Could not load the portfolio.');
    return [];
  }
  const { partnerships } = (await res.json()) as { partnerships: Partnership[] };
  return partnerships;
}
