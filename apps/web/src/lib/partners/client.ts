'use client';

import { apiFetch } from '../api/client';
import type { Partner } from './types';

export function createPartner(
  tenantId: string,
  input: { legalName: string; displayName?: string; segment?: string; domains?: string[] },
) {
  return apiFetch<{ partner: Partner }>(`/tenants/${tenantId}/partners`, {
    method: 'POST',
    body: input,
  });
}

export function updatePartner(
  tenantId: string,
  partnerId: string,
  input: {
    version: number;
    legalName?: string;
    displayName?: string;
    segment?: string;
    domains?: string[];
    status?: 'ACTIVE' | 'ARCHIVED';
  },
) {
  return apiFetch<{ partner: Partner }>(`/tenants/${tenantId}/partners/${partnerId}`, {
    method: 'PATCH',
    body: input,
  });
}
