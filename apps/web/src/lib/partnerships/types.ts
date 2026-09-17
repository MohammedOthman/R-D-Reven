export type PartnershipStage =
  | 'PROSPECT'
  | 'QUALIFIED'
  | 'PLANNING'
  | 'ACTIVE'
  | 'AT_RISK'
  | 'PAUSED'
  | 'TERMINATED'
  | 'ARCHIVED';

export const PARTNERSHIP_STAGES: PartnershipStage[] = [
  'PROSPECT',
  'QUALIFIED',
  'PLANNING',
  'ACTIVE',
  'AT_RISK',
  'PAUSED',
  'TERMINATED',
  'ARCHIVED',
];

export type PartnershipHealth = 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL';

export const PARTNERSHIP_HEALTH_VALUES: PartnershipHealth[] = [
  'HEALTHY',
  'NEEDS_ATTENTION',
  'CRITICAL',
];

/**
 * Mirrors `apps/api/src/modules/portfolio/partnerships/partnerships.service.ts`'s
 * `VALID_TRANSITIONS` — kept in sync by hand since the web app has no
 * runtime dependency on the API's source. The server re-validates every
 * transition regardless; this is only used to decide which stage buttons to
 * render.
 */
export const VALID_PARTNERSHIP_TRANSITIONS: Record<PartnershipStage, PartnershipStage[]> = {
  PROSPECT: ['QUALIFIED', 'TERMINATED'],
  QUALIFIED: ['PLANNING', 'TERMINATED'],
  PLANNING: ['ACTIVE', 'TERMINATED'],
  ACTIVE: ['AT_RISK', 'PAUSED', 'TERMINATED'],
  AT_RISK: ['ACTIVE', 'PAUSED', 'TERMINATED'],
  PAUSED: ['ACTIVE', 'AT_RISK', 'TERMINATED'],
  TERMINATED: ['ARCHIVED'],
  ARCHIVED: [],
};

export const STAGES_REQUIRING_TRANSITION_REASON: PartnershipStage[] = [
  'AT_RISK',
  'PAUSED',
  'TERMINATED',
];

export interface Partnership {
  id: string;
  partnerId: string;
  stage: PartnershipStage;
  ownerId: string | null;
  sponsorId: string | null;
  motion: string | null;
  objective: string | null;
  cadence: string | null;
  health: PartnershipHealth | null;
  nextReviewAt: string | null;
  lastTransitionReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
