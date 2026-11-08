import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { Agreement } from './types';

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

export async function getAgreements(tenantId: string): Promise<Agreement[]> {
  const result = await forwardedGet<{ agreements: Agreement[] }>(`/tenants/${tenantId}/agreements`);
  return result?.agreements ?? [];
}

export async function getAgreement(
  tenantId: string,
  agreementId: string,
): Promise<Agreement | null> {
  const result = await forwardedGet<{ agreement: Agreement }>(
    `/tenants/${tenantId}/agreements/${agreementId}`,
  );
  return result?.agreement ?? null;
}
