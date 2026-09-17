import { describe, expect, it, vi, beforeEach } from 'vitest';

const partnershipCount = vi.fn();
const partnershipFindMany = vi.fn();
const initiativeCount = vi.fn();
const initiativeFindMany = vi.fn();
const decisionCount = vi.fn();
const decisionFindMany = vi.fn();
const outcomeCount = vi.fn();
const outcomeFindMany = vi.fn();
const actionFindMany = vi.fn();

vi.mock('@revn/db', () => ({
  prisma: {
    partnership: {
      count: (...args: unknown[]) => partnershipCount(...args),
      findMany: (...args: unknown[]) => partnershipFindMany(...args),
    },
    initiative: {
      count: (...args: unknown[]) => initiativeCount(...args),
      findMany: (...args: unknown[]) => initiativeFindMany(...args),
    },
    decision: {
      count: (...args: unknown[]) => decisionCount(...args),
      findMany: (...args: unknown[]) => decisionFindMany(...args),
    },
    outcome: {
      count: (...args: unknown[]) => outcomeCount(...args),
      findMany: (...args: unknown[]) => outcomeFindMany(...args),
    },
    action: {
      findMany: (...args: unknown[]) => actionFindMany(...args),
    },
  },
}));

const { DashboardService } =
  await import('../src/modules/intelligence/dashboard/dashboard.service');

describe('DashboardService.get — S04 Command Center aggregation', () => {
  beforeEach(() => {
    partnershipCount.mockReset().mockResolvedValue(0);
    partnershipFindMany.mockReset().mockResolvedValue([]);
    initiativeCount.mockReset().mockResolvedValue(0);
    initiativeFindMany.mockReset().mockResolvedValue([]);
    decisionCount.mockReset().mockResolvedValue(0);
    decisionFindMany.mockReset().mockResolvedValue([]);
    outcomeCount.mockReset().mockResolvedValue(0);
    outcomeFindMany.mockReset().mockResolvedValue([]);
    actionFindMany.mockReset().mockResolvedValue([]);
  });

  it('reports KPI counts independent of the capped display-list size', async () => {
    // 25 at-risk partnerships exist, but the display list is capped at 10 —
    // the KPI count must still say 25, not 10.
    partnershipCount.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      where.stage === 'AT_RISK' ? 25 : 0,
    );
    partnershipFindMany.mockResolvedValue(new Array(10).fill({ id: 'ship' }));

    const service = new DashboardService();
    const result = await service.get('tenant-1');

    expect(result.kpis.atRiskPartnerships).toBe(25);
    expect(result.exceptions.atRiskPartnerships).toHaveLength(10);
  });

  it('queries active partnerships, open initiatives and pending decisions with the right filters', async () => {
    const service = new DashboardService();
    await service.get('tenant-1');

    expect(partnershipCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', stage: 'ACTIVE' } }),
    );
    expect(initiativeCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', stage: { in: ['ACTIVE', 'BLOCKED'] } },
      }),
    );
    expect(decisionCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', status: 'PENDING_APPROVAL' } }),
    );
    expect(outcomeCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', status: { in: ['SUBMITTED', 'VERIFICATION_REQUIRED'] } },
      }),
    );
  });

  it('dedupes initiativesNeedingAttention when blocked and overdue overlap', async () => {
    initiativeFindMany.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.stage === 'BLOCKED') return [{ id: 'init-1' }, { id: 'init-2' }];
      // "overdue" query: ACTIVE + targetDate < now — init-2 appears in both
      // source queries in this test to exercise the de-dup path.
      return [{ id: 'init-2' }, { id: 'init-3' }];
    });

    const service = new DashboardService();
    const result = await service.get('tenant-1');

    const ids = result.initiativesNeedingAttention.map((i) => i.id);
    expect(ids).toEqual(['init-1', 'init-2', 'init-3']);
  });

  it('reviews-due queries Partnership.nextReviewAt directly, not Review records', async () => {
    const service = new DashboardService();
    await service.get('tenant-1');

    expect(partnershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          nextReviewAt: expect.objectContaining({ lte: expect.any(Date) }),
        }),
        orderBy: { nextReviewAt: 'asc' },
      }),
    );
  });
});
