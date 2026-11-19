'use client';

import { apiFetch } from '../api/client';

export function seedEcosystemExample(tenantId: string) {
  return apiFetch<{ result: { accounts: number; edges: number } }>(
    `/tenants/${tenantId}/ecosystem/seed-example`,
    { method: 'POST' },
  );
}

export interface CreateAccountInput {
  name: string;
  domain?: string;
  headcount?: number;
  hqCity?: string;
  hqCountry?: string;
  parentName?: string;
  technologies?: string[];
  keywords?: string[];
  industryCodes?: string[];
  lists?: string[];
}

export function createAccount(tenantId: string, input: CreateAccountInput) {
  return apiFetch<{ account: { id: string; name: string } }>(`/tenants/${tenantId}/accounts`, {
    method: 'POST',
    body: input,
  });
}

export function rebuildEcosystemGraph(tenantId: string) {
  return apiFetch<{ result: { accounts: number; edges: number } }>(
    `/tenants/${tenantId}/ecosystem/rebuild`,
    { method: 'POST' },
  );
}
