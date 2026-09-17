'use client';

import { apiFetch } from '../api/client';
import type { Decision } from './types';

export function createDecisionForReview(
  tenantId: string,
  reviewId: string,
  input: {
    type?: string;
    alternatives?: string;
    rationale: string;
    deciderId?: string;
    effectiveDate: string;
    impact?: string;
    initiativeId?: string;
    requiresApproval?: boolean;
  },
) {
  return apiFetch<{ decision: Decision }>(`/tenants/${tenantId}/reviews/${reviewId}/decisions`, {
    method: 'POST',
    body: input,
  });
}

export function updateDecision(
  tenantId: string,
  decisionId: string,
  input: {
    version: number;
    status?: 'APPROVED' | 'REJECTED';
    approvalNote?: string;
    type?: string;
    alternatives?: string;
    rationale?: string;
    effectiveDate?: string;
    impact?: string;
  },
) {
  return apiFetch<{ decision: Decision }>(`/tenants/${tenantId}/decisions/${decisionId}`, {
    method: 'PATCH',
    body: input,
  });
}
