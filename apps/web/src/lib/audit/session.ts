import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { AuditEvent } from './types';

const API_URL = SERVER_API_URL;

export async function getAuditEvents(
  tenantId: string,
): Promise<{ events: AuditEvent[]; nextCursor: string | null }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) return { events: [], nextCursor: null };

  const res = await fetch(`${API_URL}/tenants/${tenantId}/audit-events`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) return { events: [], nextCursor: null };
  return (await res.json()) as { events: AuditEvent[]; nextCursor: string | null };
}
