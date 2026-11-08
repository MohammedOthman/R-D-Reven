import 'server-only';
import { cookies } from 'next/headers';
import type { Outcome } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

export async function getOutcomes(tenantId: string): Promise<Outcome[]> {
  const result = await forwardedGet<{ outcomes: Outcome[] }>(`/tenants/${tenantId}/outcomes`);
  return result?.outcomes ?? [];
}

export async function getOutcome(tenantId: string, outcomeId: string): Promise<Outcome | null> {
  const result = await forwardedGet<{ outcome: Outcome }>(
    `/tenants/${tenantId}/outcomes/${outcomeId}`,
  );
  return result?.outcome ?? null;
}
