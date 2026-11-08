'use client';

import { apiFetch } from '../api/client';
import type { TenantWithRole, Tenant } from './types';

export function createTenant(input: { name: string }) {
  return apiFetch<TenantWithRole>('/tenants', { method: 'POST', body: input });
}

export function updateTenant(
  id: string,
  input: { name?: string; timezone?: string; locale?: string },
) {
  return apiFetch<{ tenant: Tenant }>(`/tenants/${id}`, { method: 'PATCH', body: input });
}
