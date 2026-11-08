import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

const reviewFindFirst = vi.fn();
const decisionFindFirst = vi.fn();
const decisionCreate = vi.fn();
const decisionUpdate = vi.fn();
const membershipFindFirst = vi.fn();

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(`Prisma error ${code}`);
    this.code = code;
  }
}

vi.mock('@revn/db', () => ({
  prisma: {
    review: { findFirst: (...args: unknown[]) => reviewFindFirst(...args) },
    decision: {
      findFirst: (...args: unknown[]) => decisionFindFirst(...args),
      create: (...args: unknown[]) => decisionCreate(...args),
      update: (...args: unknown[]) => decisionUpdate(...args),
    },
    membership: { findFirst: (...args: unknown[]) => membershipFindFirst(...args) },
  },
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const { DecisionsService } = await import('../src/modules/execution/decisions/decisions.service');

function decision(overrides: Record<string, unknown> = {}) {
  return {
    id: 'decision-1',
    tenantId: 'tenant-1',
    partnershipId: 'ship-1',
    reviewId: 'review-1',
    rationale: 'Because the data supports it.',
    deciderId: 'user-1',
    requiresApproval: true,
    status: 'PENDING_APPROVAL',
    createdById: 'user-1',
    version: 1,
    ...overrides,
  };
}

describe('DecisionsService.createForReview', () => {
  beforeEach(() => {
    reviewFindFirst.mockReset();
    decisionCreate.mockReset();
  });

  it('throws NotFoundException when the review does not exist', async () => {
    reviewFindFirst.mockResolvedValue(null);
    const service = new DecisionsService();

    await expect(
      service.createForReview(
        'tenant-1',
        'missing',
        { rationale: 'x', effectiveDate: '2026-01-01' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(decisionCreate).not.toHaveBeenCalled();
  });

  it('starts at RECORDED when requiresApproval is not set', async () => {
    reviewFindFirst.mockResolvedValue({ id: 'review-1', partnershipId: 'ship-1' });
    decisionCreate.mockResolvedValue(decision({ requiresApproval: false, status: 'RECORDED' }));
    const service = new DecisionsService();

    await service.createForReview(
      'tenant-1',
      'review-1',
      { rationale: 'x', effectiveDate: '2026-01-01' },
      'user-1',
    );

    expect(decisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RECORDED' }) }),
    );
  });

  it('starts at PENDING_APPROVAL when requiresApproval is set', async () => {
    reviewFindFirst.mockResolvedValue({ id: 'review-1', partnershipId: 'ship-1' });
    decisionCreate.mockResolvedValue(decision());
    const service = new DecisionsService();

    await service.createForReview(
      'tenant-1',
      'review-1',
      { rationale: 'x', effectiveDate: '2026-01-01', requiresApproval: true },
      'user-1',
    );

    expect(decisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_APPROVAL' }) }),
    );
  });
});

describe('DecisionsService.update — approval and separation of duties', () => {
  beforeEach(() => {
    decisionFindFirst.mockReset();
    decisionUpdate.mockReset();
    membershipFindFirst.mockReset();
  });

  it('rejects approving a decision that is not pending approval', async () => {
    decisionFindFirst.mockResolvedValue(decision({ status: 'RECORDED', createdById: 'user-1' }));
    membershipFindFirst.mockResolvedValue({ role: 'EXECUTIVE' });
    const service = new DecisionsService();

    await expect(
      service.update('tenant-1', 'decision-1', { version: 1, status: 'APPROVED' }, 'user-2'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(decisionUpdate).not.toHaveBeenCalled();
  });

  it('rejects self-approval (INV-004)', async () => {
    decisionFindFirst.mockResolvedValue(
      decision({ status: 'PENDING_APPROVAL', createdById: 'user-1' }),
    );
    membershipFindFirst.mockResolvedValue({ role: 'EXECUTIVE' });
    const service = new DecisionsService();

    await expect(
      service.update('tenant-1', 'decision-1', { version: 1, status: 'APPROVED' }, 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(decisionUpdate).not.toHaveBeenCalled();
  });

  it('rejects approval by a role outside Owner/Executive', async () => {
    decisionFindFirst.mockResolvedValue(
      decision({ status: 'PENDING_APPROVAL', createdById: 'user-1' }),
    );
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    const service = new DecisionsService();

    await expect(
      service.update('tenant-1', 'decision-1', { version: 1, status: 'APPROVED' }, 'user-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an Executive who did not create the decision to approve it', async () => {
    decisionFindFirst.mockResolvedValue(
      decision({ status: 'PENDING_APPROVAL', createdById: 'user-1' }),
    );
    membershipFindFirst.mockResolvedValue({ role: 'EXECUTIVE' });
    decisionUpdate.mockResolvedValue(decision({ status: 'APPROVED' }));
    const service = new DecisionsService();

    await service.update('tenant-1', 'decision-1', { version: 1, status: 'APPROVED' }, 'user-2');

    expect(decisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', approvedById: 'user-2' }),
      }),
    );
  });

  it('rejects an Executive editing plain fields instead of approving', async () => {
    decisionFindFirst.mockResolvedValue(
      decision({ status: 'PENDING_APPROVAL', createdById: 'user-1' }),
    );
    membershipFindFirst.mockResolvedValue({ role: 'EXECUTIVE' });
    const service = new DecisionsService();

    await expect(
      service.update(
        'tenant-1',
        'decision-1',
        { version: 1, rationale: 'New rationale' },
        'user-2',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(decisionUpdate).not.toHaveBeenCalled();
  });

  it('allows a Manager to edit plain fields without approving', async () => {
    decisionFindFirst.mockResolvedValue(
      decision({ status: 'PENDING_APPROVAL', createdById: 'user-1' }),
    );
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    decisionUpdate.mockResolvedValue(decision({ rationale: 'New rationale' }));
    const service = new DecisionsService();

    await service.update(
      'tenant-1',
      'decision-1',
      { version: 1, rationale: 'New rationale' },
      'user-1',
    );

    expect(decisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rationale: 'New rationale' }) }),
    );
  });

  it('maps a version mismatch to ConflictException', async () => {
    decisionFindFirst.mockResolvedValue(decision({ status: 'RECORDED' }));
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    decisionUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new DecisionsService();

    await expect(
      service.update('tenant-1', 'decision-1', { version: 1, impact: 'x' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
