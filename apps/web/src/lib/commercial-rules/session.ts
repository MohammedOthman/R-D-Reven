import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { CommercialRule } from './types';

const API_URL = SERVER_API_URL;

async function forwardedGet<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return null;

  const res = await fetch(`${API_URL}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function getCommercialRules(tenantId: string): Promise<CommercialRule[]> {
  const result = await forwardedGet<{ commercialRules: CommercialRule[] }>(
    `/tenants/${tenantId}/commercial-rules`,
  );
  return result?.commercialRules ?? [];
}

export async function getCommercialRule(
  tenantId: string,
  ruleId: string,
): Promise<CommercialRule | null> {
  const result = await forwardedGet<{ commercialRule: CommercialRule }>(
    `/tenants/${tenantId}/commercial-rules/${ruleId}`,
  );
  return result?.commercialRule ?? null;
}
