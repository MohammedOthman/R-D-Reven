'use client';

import { apiFetch } from '../api/client';
import type { Member, MembershipStatus } from './types';
import type { MembershipRole } from '../tenant/types';

export function updateMember(
  tenantId: string,
  membershipId: string,
  input: { role?: MembershipRole; status?: MembershipStatus },
) {
  return apiFetch<{ member: Member }>(`/tenants/${tenantId}/members/${membershipId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function createInvitation(tenantId: string, input: { email: string; role: MembershipRole }) {
  return apiFetch<void>(`/tenants/${tenantId}/invitations`, { method: 'POST', body: input });
}

export function revokeInvitation(tenantId: string, invitationId: string) {
  return apiFetch<void>(`/tenants/${tenantId}/invitations/${invitationId}`, { method: 'DELETE' });
}
