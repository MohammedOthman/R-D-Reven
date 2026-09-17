import { Injectable } from '@nestjs/common';
import {
  prisma,
  type Action,
  type Decision,
  type Initiative,
  type Outcome,
  type Partnership,
} from '@revn/db';

const LIST_LIMIT = 10;
// "Reviews due" reads Partnership.nextReviewAt directly — the field every
// prior feature already treats as the authoritative "when's the next
// review" signal (set on activation and propagated by Review completion) —
// rather than a separate query over Review.stage. Due soon = within a week;
// overdue = already past. No PRD-named cutoff exists for "soon," so a week
// is a documented, reasonable choice.
const DUE_SOON_WINDOW_DAYS = 7;

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

@Injectable()
export class DashboardService {
  /**
   * S04's "KPI strip → exceptions → reviews due → decisions → initiatives →
   * integration health" — every section here except the last, which has no
   * data to aggregate: the `integrations` module is entirely reserved (no
   * connection has ever been created), so the web layer renders that
   * section's own "no data" empty state instead of this endpoint faking a
   * result. Same for finance-restricted data — Revenue Share doesn't exist
   * yet, so there's nothing to restrict. See docs/DECISIONS.md.
   */
  async get(tenantId: string): Promise<DashboardResponse> {
    const now = new Date();
    const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [
      activePartnerships,
      atRiskPartnershipsCount,
      atRiskPartnershipRecords,
      openInitiatives,
      pendingDecisionsCount,
      pendingDecisionRecords,
      reviewsDueCount,
      reviewsDueRecords,
      outcomesAwaitingVerification,
      blockedInitiativeRecords,
      blockedActionRecords,
      rejectedOutcomeRecords,
      overdueInitiativeRecords,
    ] = await Promise.all([
      prisma.partnership.count({ where: { tenantId, stage: 'ACTIVE' } }),
      prisma.partnership.count({ where: { tenantId, stage: 'AT_RISK' } }),
      prisma.partnership.findMany({
        where: { tenantId, stage: 'AT_RISK' },
        orderBy: { updatedAt: 'desc' },
        take: LIST_LIMIT,
      }),
      prisma.initiative.count({ where: { tenantId, stage: { in: ['ACTIVE', 'BLOCKED'] } } }),
      prisma.decision.count({ where: { tenantId, status: 'PENDING_APPROVAL' } }),
      prisma.decision.findMany({
        where: { tenantId, status: 'PENDING_APPROVAL' },
        orderBy: { createdAt: 'asc' },
        take: LIST_LIMIT,
      }),
      prisma.partnership.count({ where: { tenantId, nextReviewAt: { lte: dueSoonCutoff } } }),
      prisma.partnership.findMany({
        where: { tenantId, nextReviewAt: { lte: dueSoonCutoff } },
        orderBy: { nextReviewAt: 'asc' },
        take: LIST_LIMIT,
      }),
      prisma.outcome.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'VERIFICATION_REQUIRED'] } },
      }),
      prisma.initiative.findMany({
        where: { tenantId, stage: 'BLOCKED' },
        orderBy: { updatedAt: 'desc' },
        take: LIST_LIMIT,
      }),
      prisma.action.findMany({
        where: { tenantId, status: 'BLOCKED' },
        orderBy: { updatedAt: 'desc' },
        take: LIST_LIMIT,
      }),
      prisma.outcome.findMany({
        where: { tenantId, status: 'REJECTED' },
        orderBy: { updatedAt: 'desc' },
        take: LIST_LIMIT,
      }),
      prisma.initiative.findMany({
        where: { tenantId, stage: 'ACTIVE', targetDate: { lt: now } },
        orderBy: { targetDate: 'asc' },
        take: LIST_LIMIT,
      }),
    ]);

    // "Needing attention" = blocked outright, or active with a missed target
    // date — deduplicated by id since an initiative could theoretically be
    // both (blocked and overdue), and the two source queries could overlap.
    const initiativesNeedingAttention = [
      ...blockedInitiativeRecords,
      ...overdueInitiativeRecords.filter(
        (i) => !blockedInitiativeRecords.some((b) => b.id === i.id),
      ),
    ].slice(0, LIST_LIMIT);

    return {
      kpis: {
        activePartnerships,
        atRiskPartnerships: atRiskPartnershipsCount,
        openInitiatives,
        pendingDecisions: pendingDecisionsCount,
        reviewsDue: reviewsDueCount,
        outcomesAwaitingVerification,
      },
      exceptions: {
        atRiskPartnerships: atRiskPartnershipRecords,
        blockedInitiatives: blockedInitiativeRecords,
        blockedActions: blockedActionRecords,
        rejectedOutcomes: rejectedOutcomeRecords,
      },
      reviewsDue: reviewsDueRecords,
      pendingDecisions: pendingDecisionRecords,
      initiativesNeedingAttention,
    };
  }
}
