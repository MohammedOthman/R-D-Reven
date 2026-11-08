import type { Action } from '../actions/types';

export type InitiativeStage =
  'DRAFT' | 'PROPOSED' | 'APPROVED' | 'ACTIVE' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';

export const INITIATIVE_STAGES: InitiativeStage[] = [
  'DRAFT',
  'PROPOSED',
  'APPROVED',
  'ACTIVE',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
];

/**
 * Mirrors `apps/api/.../initiatives/initiatives.service.ts`'s
 * `VALID_TRANSITIONS` — kept in sync by hand. The server re-validates every
 * transition regardless; this only decides which buttons to render.
 */
export const VALID_INITIATIVE_TRANSITIONS: Record<InitiativeStage, InitiativeStage[]> = {
  DRAFT: ['PROPOSED', 'CANCELLED'],
  PROPOSED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['BLOCKED', 'COMPLETED', 'CANCELLED'],
  BLOCKED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export type InitiativeVisibility = 'PRIVATE' | 'SHAREABLE';
export type InitiativeHealth = 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL';
export type InitiativeCompletionDisposition = 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'NOT_ACHIEVED';
export type RemainingActionsTreatment = 'CANCEL_REMAINING' | 'LEAVE_OPEN';

export const INITIATIVE_HEALTH_VALUES: InitiativeHealth[] = [
  'HEALTHY',
  'NEEDS_ATTENTION',
  'CRITICAL',
];
export const COMPLETION_DISPOSITION_VALUES: InitiativeCompletionDisposition[] = [
  'ACHIEVED',
  'PARTIALLY_ACHIEVED',
  'NOT_ACHIEVED',
];

export interface Milestone {
  id: string;
  initiativeId: string;
  title: string;
  targetDate: string;
  ownerId: string | null;
  completionRule: string | null;
  order: number;
  completedAt: string | null;
  version: number;
}

export interface Initiative {
  id: string;
  partnershipId: string;
  objective: string;
  successMeasure: Record<string, unknown> | null;
  visibility: InitiativeVisibility;
  health: InitiativeHealth | null;
  ownerId: string | null;
  startDate: string | null;
  targetDate: string | null;
  stage: InitiativeStage;
  completionDisposition: InitiativeCompletionDisposition | null;
  remainingActionsTreatment: RemainingActionsTreatment | null;
  completionOverrideReason: string | null;
  lastTransitionReason: string | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
  milestones?: Milestone[];
  actions?: Action[];
}
