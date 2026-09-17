'use client';

import { apiFetch } from '../api/client';
import type { Contribution, EvidenceClassification } from './types';

export function createContribution(
  tenantId: string,
  input: {
    partnershipId?: string;
    initiativeId?: string;
    actionId?: string;
    outcomeId?: string;
    type: string;
    actorId?: string;
    observedAt: string;
    narrative: string;
    classification?: EvidenceClassification;
  },
) {
  return apiFetch<{ contribution: Contribution }>(`/tenants/${tenantId}/contributions`, {
    method: 'POST',
    body: input,
  });
}
