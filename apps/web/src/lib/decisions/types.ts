export type DecisionStatus = 'RECORDED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface Decision {
  id: string;
  partnershipId: string;
  reviewId: string | null;
  initiativeId: string | null;
  type: string | null;
  alternatives: string | null;
  rationale: string;
  deciderId: string;
  effectiveDate: string;
  impact: string | null;
  requiresApproval: boolean;
  status: DecisionStatus;
  approvedById: string | null;
  approvalNote: string | null;
  decidedAt: string | null;
  version: number;
  createdById: string;
}
