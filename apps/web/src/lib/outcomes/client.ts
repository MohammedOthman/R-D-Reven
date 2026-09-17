'use client';

import { apiFetch } from '../api/client';
import type { Outcome, OutcomeStatus } from './types';

export function createOutcome(
  tenantId: string,
  input: {
    partnershipId: string;
    initiativeId?: string;
    type: string;
    claimedResult: string;
    value?: string;
    unit?: string;
    period?: string;
  },
) {
  return apiFetch<{ outcome: Outcome }>(`/tenants/${tenantId}/outcomes`, {
    method: 'POST',
    body: input,
  });
}

export function updateOutcome(
  tenantId: string,
  outcomeId: string,
  input: {
    version: number;
    status?: Extract<
      OutcomeStatus,
      'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'VERIFICATION_REQUIRED'
    >;
    verifierId?: string;
    verifierDisposition?: string;
    rejectionReason?: string;
    type?: string;
    claimedResult?: string;
    value?: string;
    unit?: string;
    period?: string;
  },
) {
  return apiFetch<{ outcome: Outcome }>(`/tenants/${tenantId}/outcomes/${outcomeId}`, {
    method: 'PATCH',
    body: input,
  });
}
