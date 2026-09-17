'use client';

import { apiFetch } from '../api/client';
import type { Action, ActionStatus } from './types';

interface CreateActionInput {
  title: string;
  milestoneId?: string;
  assigneeUserId?: string;
  assigneeExternalName?: string;
  dueDate?: string;
}

export function createActionForInitiative(
  tenantId: string,
  initiativeId: string,
  input: CreateActionInput,
) {
  return apiFetch<{ action: Action }>(`/tenants/${tenantId}/initiatives/${initiativeId}/actions`, {
    method: 'POST',
    body: input,
  });
}

export function createActionForReview(
  tenantId: string,
  reviewId: string,
  input: CreateActionInput,
) {
  return apiFetch<{ action: Action }>(`/tenants/${tenantId}/reviews/${reviewId}/actions`, {
    method: 'POST',
    body: input,
  });
}

export function updateAction(
  tenantId: string,
  actionId: string,
  input: {
    version: number;
    status?: ActionStatus;
    blockerReason?: string;
    completionNote?: string;
    title?: string;
    milestoneId?: string;
    assigneeUserId?: string;
    assigneeExternalName?: string;
    dueDate?: string;
  },
) {
  return apiFetch<{ action: Action }>(`/tenants/${tenantId}/actions/${actionId}`, {
    method: 'PATCH',
    body: input,
  });
}
