'use client';

import { apiFetch } from '../api/client';
import type { Agreement, AgreementStatus, AgreementVersion } from './types';

export function createAgreement(tenantId: string, input: { partnershipId: string; sourceRef?: string }) {
  return apiFetch<{ agreement: Agreement }>(`/tenants/${tenantId}/agreements`, {
    method: 'POST',
    body: input,
  });
}

export function updateAgreement(
  tenantId: string,
  agreementId: string,
  input: { version: number; status?: AgreementStatus; transitionReason?: string; sourceRef?: string },
) {
  return apiFetch<{ agreement: Agreement }>(`/tenants/${tenantId}/agreements/${agreementId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function createAgreementVersion(
  tenantId: string,
  agreementId: string,
  input: { initiativeId?: string; terms?: string; effectiveFrom: string; effectiveTo?: string },
) {
  return apiFetch<{ agreementVersion: AgreementVersion }>(
    `/tenants/${tenantId}/agreements/${agreementId}/versions`,
    { method: 'POST', body: input },
  );
}

export function updateAgreementVersion(
  tenantId: string,
  agreementId: string,
  versionId: string,
  input: {
    version: number;
    approvalStatus?: 'APPROVED';
    terms?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
  },
) {
  return apiFetch<{ agreementVersion: AgreementVersion }>(
    `/tenants/${tenantId}/agreements/${agreementId}/versions/${versionId}`,
    { method: 'PATCH', body: input },
  );
}
