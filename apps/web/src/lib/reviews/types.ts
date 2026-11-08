import type { Action } from '../actions/types';
import type { Decision } from '../decisions/types';

export type ReviewStage = 'SCHEDULED' | 'IN_PREPARATION' | 'IN_PROGRESS' | 'COMPLETED' | 'REOPENED';

export const REVIEW_STAGES: ReviewStage[] = [
  'SCHEDULED',
  'IN_PREPARATION',
  'IN_PROGRESS',
  'COMPLETED',
  'REOPENED',
];

/**
 * Mirrors `apps/api/.../reviews/reviews.service.ts`'s `VALID_TRANSITIONS` —
 * kept in sync by hand. Unlike Partnership/Initiative/Action, the path
 * stays strictly linear — no PRD text suggests a "stuck" state a review
 * needs to recover from. `Reopened` is unreachable (REV-06, deferred).
 */
export const VALID_REVIEW_TRANSITIONS: Record<ReviewStage, ReviewStage[]> = {
  SCHEDULED: ['IN_PREPARATION'],
  IN_PREPARATION: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  REOPENED: [],
};

export type ReviewNotesClassification = 'INTERNAL' | 'SHAREABLE';

export const REVIEW_NOTES_CLASSIFICATIONS: ReviewNotesClassification[] = ['INTERNAL', 'SHAREABLE'];

export interface Review {
  id: string;
  partnershipId: string;
  period: string | null;
  scheduledFor: string;
  ownerId: string | null;
  participantUserIds: string[];
  notes: string | null;
  notesClassification: ReviewNotesClassification;
  snapshotId: string | null;
  snapshot: {
    partnership: Record<string, unknown> | null;
    initiatives: Record<string, unknown>[];
  } | null;
  snapshotAt: string | null;
  nextReviewAt: string | null;
  stage: ReviewStage;
  completedAt: string | null;
  version: number;
  createdAt: string;
  decisions?: Decision[];
  actions?: Action[];
}
