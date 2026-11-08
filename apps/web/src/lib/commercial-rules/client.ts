'use client';

import { apiFetch } from '../api/client';
import type { CommercialRule, CommercialRuleType, CommercialRuleVersion, RuleDefinition } from './types';

export function createCommercialRule(
  tenantId: string,
  input: { name: string; type: CommercialRuleType },
) {
  return apiFetch<{ commercialRule: CommercialRule }>(`/tenants/${tenantId}/commercial-rules`, {
    method: 'POST',
    body: input,
  });
}

export function updateCommercialRule(
  tenantId: string,
  ruleId: string,
  input: { version: number; name?: string },
) {
  return apiFetch<{ commercialRule: CommercialRule }>(`/tenants/${tenantId}/commercial-rules/${ruleId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function createCommercialRuleVersion(
  tenantId: string,
  ruleId: string,
  input: { definition: RuleDefinition; precedence?: number; effectiveFrom: string; effectiveTo?: string },
) {
  return apiFetch<{ commercialRuleVersion: CommercialRuleVersion }>(
    `/tenants/${tenantId}/commercial-rules/${ruleId}/versions`,
    { method: 'POST', body: input },
  );
}

export function updateCommercialRuleVersion(
  tenantId: string,
  ruleId: string,
  versionId: string,
  input: {
    version: number;
    approvalStatus?: 'APPROVED';
    definition?: RuleDefinition;
    precedence?: number;
    effectiveFrom?: string;
    effectiveTo?: string;
  },
) {
  return apiFetch<{ commercialRuleVersion: CommercialRuleVersion }>(
    `/tenants/${tenantId}/commercial-rules/${ruleId}/versions/${versionId}`,
    { method: 'PATCH', body: input },
  );
}

export function testCommercialRuleVersion(
  tenantId: string,
  ruleId: string,
  versionId: string,
  input: { cases: { label?: string; input: Record<string, unknown>; expectedResult: boolean }[] },
) {
  return apiFetch<{ commercialRuleVersion: CommercialRuleVersion }>(
    `/tenants/${tenantId}/commercial-rules/${ruleId}/versions/${versionId}/test`,
    { method: 'POST', body: input },
  );
}
