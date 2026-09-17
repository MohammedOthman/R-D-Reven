import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

const reviewFindFirst = vi.fn();
const reviewUpdate = vi.fn();
const partnershipFindFirst = vi.fn();
const partnershipUpdate = vi.fn();
const initiativeFindMany = vi.fn();
const decisionCount = vi.fn();
const actionCount = vi.fn();

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(`Prisma error ${code}`);
    this.code = code;
  }
}

const txClient = {
  review: { update: (...args: unknown[]) => reviewUpdate(...args) },
  partnership: { update: (...args: unknown[]) => partnershipUpdate(...args) },
};

vi.mock('@revn/db', () => ({
  prisma: {
    review: {
      findFirst: (...args: unknown[]) => reviewFindFirst(...args),
      update: (...args: unknown[]) => reviewUpdate(...args),
    },
    partnership: {
      findFirst: (...args: unknown[]) => partnershipFindFirst(...args),
      update: (...args: unknown[]) => partnershipUpdate(...args),
    },
    initiative: {
      findMany: (...args: unknown[]) => initiativeFindMany(...args),
    },
    decision: {
      count: (...args: unknown[]) => decisionCount(...args),
    },
    action: {
      count: (...args: unknown[]) => actionCount(...args),
    },
    $transaction: async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof txClient) => Promise<unknown>)(txClient);
      }
      return Promise.all(arg as Promise<unknown>[]);
    },
  },
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const { ReviewsService } = await import('../src/modules/execution/reviews/reviews.service');

function review(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-1',
    tenantId: 'tenant-1',
    partnershipId: 'ship-1',
    stage: 'SCHEDULED',
    snapshotId: null,
    snapshot: null,
    snapshotAt: null,
    nextReviewAt: null,
    completedAt: null,
    version: 1,
    ...overrides,
  };
}

describe('ReviewsService.update — stage transitions', () => {
  beforeEach(() => {
    reviewFindFirst.mockReset();
    reviewUpdate.mockReset();
    partnershipFindFirst.mockReset();
    partnershipUpdate.mockReset();
    initiativeFindMany.mockReset();
    decisionCount.mockReset();
    actionCount.mockReset();
  });

  it('rejects a transition that skips a stage (Scheduled -> In Progress)', async () => {
    reviewFindFirst.mockResolvedValue(review({ stage: 'SCHEDULED' }));
    const service = new ReviewsService();

    await expect(
      service.update('tenant-1', 'review-1', { version: 1, stage: 'IN_PROGRESS' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(reviewUpdate).not.toHaveBeenCalled();
  });

  it('captures a snapshot when moving Scheduled -> In Preparation', async () => {
    reviewFindFirst.mockResolvedValue(review({ stage: 'SCHEDULED' }));
    partnershipFindFirst.mockResolvedValue({
      stage: 'ACTIVE',
      health: 'HEALTHY',
      nextReviewAt: null,
    });
    initiativeFindMany.mockResolvedValue([
      { id: 'init-1', objective: 'Grow', stage: 'ACTIVE', health: null },
    ]);
    reviewUpdate.mockResolvedValue(review({ stage: 'IN_PREPARATION' }));
    const service = new ReviewsService();

    await service.update('tenant-1', 'review-1', { version: 1, stage: 'IN_PREPARATION' }, 'user-1');

    expect(reviewUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotId: expect.any(String),
          snapshot: expect.objectContaining({
            partnership: expect.any(Object),
            initiatives: expect.any(Array),
          }),
          snapshotAt: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects completion without a next review date', async () => {
    reviewFindFirst.mockResolvedValue(review({ stage: 'IN_PROGRESS' }));
    const service = new ReviewsService();

    await expect(
      service.update('tenant-1', 'review-1', { version: 1, stage: 'COMPLETED' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(reviewUpdate).not.toHaveBeenCalled();
  });

  it('rejects completion with a decision still pending approval (T-008)', async () => {
    reviewFindFirst.mockResolvedValue(review({ stage: 'IN_PROGRESS' }));
    decisionCount.mockResolvedValue(1);
    actionCount.mockResolvedValue(0);
    const service = new ReviewsService();

    await expect(
      service.update(
        'tenant-1',
        'review-1',
        { version: 1, stage: 'COMPLETED', nextReviewAt: '2026-04-01T00:00:00Z' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(reviewUpdate).not.toHaveBeenCalled();
  });

  it('rejects completion with an open follow-up action (T-008)', async () => {
    reviewFindFirst.mockResolvedValue(review({ stage: 'IN_PROGRESS' }));
    decisionCount.mockResolvedValue(0);
    actionCount.mockResolvedValue(1);
    const service = new ReviewsService();

    await expect(
      service.update(
        'tenant-1',
        'review-1',
        { version: 1, stage: 'COMPLETED', nextReviewAt: '2026-04-01T00:00:00Z' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('completes and propagates nextReviewAt onto the parent partnership', async () => {
    reviewFindFirst.mockResolvedValue(review({ stage: 'IN_PROGRESS' }));
    decisionCount.mockResolvedValue(0);
    actionCount.mockResolvedValue(0);
    reviewUpdate.mockResolvedValue(review({ stage: 'COMPLETED' }));
    const service = new ReviewsService();

    await service.update(
      'tenant-1',
      'review-1',
      { version: 1, stage: 'COMPLETED', nextReviewAt: '2026-04-01T00:00:00Z' },
      'user-1',
    );

    expect(partnershipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ship-1' },
        data: { nextReviewAt: new Date('2026-04-01T00:00:00Z') },
      }),
    );
  });

  it('maps a version mismatch to ConflictException', async () => {
    reviewFindFirst.mockResolvedValue(review({ stage: 'SCHEDULED' }));
    reviewUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new ReviewsService();

    await expect(
      service.update('tenant-1', 'review-1', { version: 1, period: 'Monthly' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException for a review that does not exist', async () => {
    reviewFindFirst.mockResolvedValue(null);
    const service = new ReviewsService();

    await expect(
      service.update('tenant-1', 'missing', { version: 1, period: 'Monthly' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
