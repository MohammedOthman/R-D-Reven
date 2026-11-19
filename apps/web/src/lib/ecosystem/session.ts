import 'server-only';
import { cookies } from 'next/headers';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import type { EcosystemAccountDetail, EcosystemGraph } from './types';

const API_URL = SERVER_API_URL;

export async function getEcosystemGraph(
  tenantId: string,
  options: { failOnError?: boolean } = {},
): Promise<EcosystemGraph | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    if (options.failOnError) throw new Error('Ecosystem session is unavailable.');
    return null;
  }

  const res = await fetch(`${API_URL}/tenants/${tenantId}/ecosystem/graph`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) {
    if (options.failOnError) throw new Error('Could not load the ecosystem graph.');
    return null;
  }
  const { graph } = (await res.json()) as { graph: EcosystemGraph };
  return graph;
}

export async function getEcosystemAccount(
  tenantId: string,
  accountId: string,
): Promise<EcosystemAccountDetail | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  const res = await fetch(`${API_URL}/tenants/${tenantId}/ecosystem/accounts/${accountId}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as EcosystemAccountDetail;
}
