'use client';

import { apiFetch } from '../api/client';
import type { Partnership, PartnershipHealth, PartnershipStage } from './types';

export function createPartnership(
  tenantId: string,
  partnerId: string,
  input: {
    ownerId?: string;
    sponsorId?: string;
    motion?: string;
    objective?: string;
    cadence?: string;
  },
) {
  return apiFetch<{ partnership: Partnership }>(
    `/tenants/${tenantId}/partners/${partnerId}/partnership`,
    { method: 'POST', body: input },
  );
}

export function updatePartnership(
  tenantId: string,
  partnerId: string,
  input: {
    version: number;
    stage?: PartnershipStage;
    transitionReason?: string;
    ownerId?: string;
    sponsorId?: string;
    motion?: string;
    objective?: string;
    cadence?: string;
    health?: PartnershipHealth;
    nextReviewAt?: string;
  },
) {
  return apiFetch<{ partnership: Partnership }>(
    `/tenants/${tenantId}/partners/${partnerId}/partnership`,
    { method: 'PATCH', body: input },
  );
}
