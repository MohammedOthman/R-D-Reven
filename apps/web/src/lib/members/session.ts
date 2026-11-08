import 'server-only';
import { SERVER_API_URL } from '@/src/lib/api/server-url';
import { cookies } from 'next/headers';
import type { Member, Invitation, MemberSummary } from './types';

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

/** Only called by the Administration page after it's already confirmed OWNER/ADMIN from `getCurrentTenant()` — a 403 here would mean that check and this one disagree, which shouldn't happen. */
export async function getMembers(tenantId: string): Promise<Member[]> {
  const result = await forwardedGet<{ members: Member[] }>(`/tenants/${tenantId}/members`);
  return result?.members ?? [];
}

export async function getInvitations(tenantId: string): Promise<Invitation[]> {
  const result = await forwardedGet<{ invitations: Invitation[] }>(
    `/tenants/${tenantId}/invitations`,
  );
  return result?.invitations ?? [];
}

/** Any tenant member with portfolio-read access can call this — used to populate the owner/sponsor picker on a partnership, not for member management. */
export async function getMemberDirectory(tenantId: string): Promise<MemberSummary[]> {
  const result = await forwardedGet<{ members: MemberSummary[] }>(
    `/tenants/${tenantId}/members/directory`,
  );
  return result?.members ?? [];
}
