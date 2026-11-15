'use client';

import { apiDownload, apiFetch, apiUpload } from '../api/client';
import type { Evidence, EvidenceClassification } from './types';

export function downloadEvidenceFile(tenantId: string, evidenceId: string) {
  return apiDownload(`/tenants/${tenantId}/evidence/${evidenceId}/file`);
}

export function createEvidence(
  tenantId: string,
  input: {
    contributionId?: string;
    outcomeId?: string;
    source: string;
    observedAt: string;
    classification?: EvidenceClassification;
  },
) {
  return apiFetch<{ evidence: Evidence }>(`/tenants/${tenantId}/evidence`, {
    method: 'POST',
    body: input,
  });
}

/** EVD-02's upload step — a separate request from `createEvidence`, see docs/DECISIONS.md. */
export function uploadEvidenceFile(tenantId: string, evidenceId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<{ evidence: Evidence }>(
    `/tenants/${tenantId}/evidence/${evidenceId}/file`,
    formData,
  );
}

/** EVD-04: creates a new evidence version — never overwrites the prior material file. */
export function replaceEvidence(
  tenantId: string,
  evidenceId: string,
  input: { source: string; observedAt: string; classification?: EvidenceClassification },
) {
  return apiFetch<{ evidence: Evidence }>(`/tenants/${tenantId}/evidence/${evidenceId}/replace`, {
    method: 'POST',
    body: input,
  });
}
