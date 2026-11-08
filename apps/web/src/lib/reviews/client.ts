'use client';

import { apiFetch } from '../api/client';
import type { Review, ReviewNotesClassification, ReviewStage } from './types';

export function createReview(
  tenantId: string,
  input: {
    partnershipId: string;
    scheduledFor: string;
    period?: string;
    ownerId?: string;
    participantUserIds?: string[];
  },
) {
  return apiFetch<{ review: Review }>(`/tenants/${tenantId}/reviews`, {
    method: 'POST',
    body: input,
  });
}

export function updateReview(
  tenantId: string,
  reviewId: string,
  input: {
    version: number;
    stage?: ReviewStage;
    scheduledFor?: string;
    period?: string;
    ownerId?: string;
    participantUserIds?: string[];
    notes?: string;
    notesClassification?: ReviewNotesClassification;
    nextReviewAt?: string;
  },
) {
  return apiFetch<{ review: Review }>(`/tenants/${tenantId}/reviews/${reviewId}`, {
    method: 'PATCH',
    body: input,
  });
}
