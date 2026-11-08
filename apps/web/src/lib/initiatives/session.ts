import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { Initiative } from './types';

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

export async function getInitiatives(tenantId: string): Promise<Initiative[]> {
  const result = await forwardedGet<{ initiatives: Initiative[] }>(
    `/tenants/${tenantId}/initiatives`,
  );
  return result?.initiatives ?? [];
}

export async function getInitiative(
  tenantId: string,
  initiativeId: string,
): Promise<Initiative | null> {
  const result = await forwardedGet<{ initiative: Initiative }>(
    `/tenants/${tenantId}/initiatives/${initiativeId}`,
  );
  return result?.initiative ?? null;
}
