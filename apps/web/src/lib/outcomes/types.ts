import type { Contribution } from '../contributions/types';
import type { Evidence } from '../evidence/types';

export type OutcomeStatus =
  'DRAFT' | 'SUBMITTED' | 'VERIFICATION_REQUIRED' | 'VERIFIED' | 'REJECTED' | 'SUPERSEDED';

/**
 * Mirrors `apps/api/.../outcomes/outcomes.service.ts`'s `VALID_TRANSITIONS` —
 * kept in sync by hand. Table 13's chain is read as a reachability list, not
 * a strict sequence — a verifier takes one of three actions from Submitted,
 * and Verification Required has a documented recovery move back to
 * Submitted (the same "stuck state" pattern as every other state machine in
 * this codebase). Superseded is unreachable — OUT-04 is P1 and deferred.
 */
export const VALID_OUTCOME_TRANSITIONS: Record<OutcomeStatus, OutcomeStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['VERIFIED', 'REJECTED', 'VERIFICATION_REQUIRED'],
  VERIFICATION_REQUIRED: ['SUBMITTED'],
  VERIFIED: [],
  REJECTED: [],
  SUPERSEDED: [],
};

export interface Outcome {
  id: string;
  partnershipId: string;
  initiativeId: string | null;
  type: string;
  claimedResult: string;
  value: string | null;
  unit: string | null;
  period: string | null;
  status: OutcomeStatus;
  verifierId: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifierDisposition: string | null;
  rejectionReason: string | null;
  version: number;
  createdAt: string;
  createdById: string;
  contributions?: Contribution[];
  evidence?: Evidence[];
}
