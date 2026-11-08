import type { Partnership } from '../partnerships/types';
import type { Initiative } from '../initiatives/types';
import type { Action } from '../actions/types';
import type { Decision } from '../decisions/types';
import type { Outcome } from '../outcomes/types';

export interface DashboardResponse {
  kpis: {
    activePartnerships: number;
    atRiskPartnerships: number;
    openInitiatives: number;
    pendingDecisions: number;
    reviewsDue: number;
    outcomesAwaitingVerification: number;
  };
  exceptions: {
    atRiskPartnerships: Partnership[];
    blockedInitiatives: Initiative[];
    blockedActions: Action[];
    rejectedOutcomes: Outcome[];
  };
  reviewsDue: Partnership[];
  pendingDecisions: Decision[];
  initiativesNeedingAttention: Initiative[];
}
