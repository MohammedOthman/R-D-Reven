'use client';

import { apiFetch } from '../api/client';
import type {
  Initiative,
  InitiativeCompletionDisposition,
  InitiativeHealth,
  InitiativeStage,
  InitiativeVisibility,
  Milestone,
  RemainingActionsTreatment,
} from './types';

export function createInitiative(
  tenantId: string,
  input: {
    partnershipId: string;
    objective: string;
    successMeasure?: Record<string, unknown>;
    visibility?: InitiativeVisibility;
    ownerId?: string;
    startDate?: string;
    targetDate?: string;
  },
) {
  return apiFetch<{ initiative: Initiative }>(`/tenants/${tenantId}/initiatives`, {
    method: 'POST',
    body: input,
  });
}

export function updateInitiative(
  tenantId: string,
  initiativeId: string,
  input: {
    version: number;
    stage?: InitiativeStage;
    lastTransitionReason?: string;
    objective?: string;
    successMeasure?: Record<string, unknown>;
    visibility?: InitiativeVisibility;
    health?: InitiativeHealth;
    ownerId?: string;
    startDate?: string;
    targetDate?: string;
    completionDisposition?: InitiativeCompletionDisposition;
    remainingActionsTreatment?: RemainingActionsTreatment;
    completionOverrideReason?: string;
  },
) {
  return apiFetch<{ initiative: Initiative }>(`/tenants/${tenantId}/initiatives/${initiativeId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function createMilestone(
  tenantId: string,
  initiativeId: string,
  input: { title: string; targetDate: string; ownerId?: string; completionRule?: string },
) {
  return apiFetch<{ milestone: Milestone }>(
    `/tenants/${tenantId}/initiatives/${initiativeId}/milestones`,
    { method: 'POST', body: input },
  );
}

export function updateMilestone(
  tenantId: string,
  initiativeId: string,
  milestoneId: string,
  input: {
    version: number;
    title?: string;
    targetDate?: string;
    ownerId?: string;
    completionRule?: string;
    completed?: boolean;
  },
) {
  return apiFetch<{ milestone: Milestone }>(
    `/tenants/${tenantId}/initiatives/${initiativeId}/milestones/${milestoneId}`,
    { method: 'PATCH', body: input },
  );
}
