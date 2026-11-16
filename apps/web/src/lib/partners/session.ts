import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { Partner } from './types';

const API_URL = SERVER_API_URL;

/** Only called after the page has already confirmed read access via `getCurrentTenant()`'s role. */
export async function getPartners(
  tenantId: string,
  options: { failOnError?: boolean } = {},
): Promise<Partner[]> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    if (options.failOnError) throw new Error('Portfolio session is unavailable.');
    return [];
  }

  const res = await fetch(`${API_URL}/tenants/${tenantId}/partners`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) {
    if (options.failOnError) throw new Error('Could not load the portfolio.');
    return [];
  }
  const { partners } = (await res.json()) as { partners: Partner[] };
  return partners;
}
