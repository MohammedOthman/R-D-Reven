export type AgreementStatus =
  | 'CAPTURED'
  | 'IN_REVIEW'
  | 'EFFECTIVE'
  | 'AMENDED'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'TERMINATED';

export const AGREEMENT_STATUSES: AgreementStatus[] = [
  'CAPTURED',
  'IN_REVIEW',
  'EFFECTIVE',
  'AMENDED',
  'SUSPENDED',
  'EXPIRED',
  'TERMINATED',
];

export type ApprovalStatus = 'DRAFT' | 'APPROVED';

/**
 * Mirrors `apps/api/.../agreements/agreements.service.ts`'s `VALID_TRANSITIONS`
 * — kept in sync by hand, same convention as reviews/types.ts. EFFECTIVE and
 * AMENDED are excluded on purpose: they are only reachable as the automatic
 * side effect of approving an AgreementVersion, never settable directly.
 */
export const VALID_AGREEMENT_TRANSITIONS: Record<AgreementStatus, AgreementStatus[]> = {
  CAPTURED: ['IN_REVIEW', 'TERMINATED'],
  IN_REVIEW: ['CAPTURED', 'TERMINATED'],
  EFFECTIVE: ['SUSPENDED', 'EXPIRED', 'TERMINATED'],
  AMENDED: ['SUSPENDED', 'EXPIRED', 'TERMINATED'],
  SUSPENDED: ['EFFECTIVE', 'TERMINATED'],
  EXPIRED: [],
  TERMINATED: [],
};

export interface AgreementVersion {
  id: string;
  agreementId: string;
  initiativeId: string | null;
  versionNumber: number;
  terms: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvalStatus: ApprovalStatus;
  approvedById: string | null;
  approvedAt: string | null;
  version: number;
  createdAt: string;
}

export interface Agreement {
  id: string;
  partnershipId: string;
  sourceRef: string | null;
  status: AgreementStatus;
  version: number;
  createdAt: string;
  versions?: AgreementVersion[];
}
