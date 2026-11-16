import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

const partnershipFindFirst = vi.fn();
const initiativeFindFirst = vi.fn();
const outcomeFindFirst = vi.fn();
const outcomeCreate = vi.fn();
const outcomeUpdate = vi.fn();
const membershipFindFirst = vi.fn();
const evidenceCount = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock('../src/modules/audit-operations/audit.service', () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(`Prisma error ${code}`);
    this.code = code;
  }
}

vi.mock('@revn/db', () => ({
  prisma: {
    partnership: { findFirst: (...args: unknown[]) => partnershipFindFirst(...args) },
    initiative: { findFirst: (...args: unknown[]) => initiativeFindFirst(...args) },
    outcome: {
      findFirst: (...args: unknown[]) => outcomeFindFirst(...args),
      create: (...args: unknown[]) => outcomeCreate(...args),
      update: (...args: unknown[]) => outcomeUpdate(...args),
    },
    membership: { findFirst: (...args: unknown[]) => membershipFindFirst(...args) },
    evidence: { count: (...args: unknown[]) => evidenceCount(...args) },
  },
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const { OutcomesService } =
  await import('../src/modules/evidence-outcomes/outcomes/outcomes.service');

function outcome(overrides: Record<string, unknown> = {}) {
  return {
    id: 'outcome-1',
    tenantId: 'tenant-1',
    partnershipId: 'ship-1',
    type: 'Revenue',
    claimedResult: 'Grew pipeline by 20%',
    status: 'DRAFT',
    verifierId: null,
    createdById: 'user-1',
    version: 1,
    ...overrides,
  };
}

describe('OutcomesService.create', () => {
  beforeEach(() => {
    partnershipFindFirst.mockReset();
    initiativeFindFirst.mockReset();
    outcomeCreate.mockReset();
  });

  it('throws NotFoundException when the partnership does not exist', async () => {
    partnershipFindFirst.mockResolvedValue(null);
    const service = new OutcomesService();

    await expect(
      service.create(
        'tenant-1',
        { partnershipId: 'missing', type: 'Revenue', claimedResult: 'x' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(outcomeCreate).not.toHaveBeenCalled();
  });

  it('rejects a value given without its unit (OUT-01 type-specific validation)', async () => {
    partnershipFindFirst.mockResolvedValue({ id: 'ship-1' });
    const service = new OutcomesService();

    await expect(
      service.create(
        'tenant-1',
        { partnershipId: 'ship-1', type: 'Revenue', claimedResult: 'x', value: '100' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(outcomeCreate).not.toHaveBeenCalled();
  });

  it('creates a draft outcome when value and unit are given together', async () => {
    partnershipFindFirst.mockResolvedValue({ id: 'ship-1' });
    outcomeCreate.mockResolvedValue(outcome());
    const service = new OutcomesService();

    await service.create(
      'tenant-1',
      { partnershipId: 'ship-1', type: 'Revenue', claimedResult: 'x', value: '100', unit: 'USD' },
      'user-1',
    );

    expect(outcomeCreate).toHaveBeenCalled();
  });
});

describe('OutcomesService.update — submission (OUT-02)', () => {
  beforeEach(() => {
    outcomeFindFirst.mockReset();
    outcomeUpdate.mockReset();
    membershipFindFirst.mockReset();
  });

  it('rejects submitting without an assigned verifier', async () => {
    outcomeFindFirst.mockResolvedValue(outcome());
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    const service = new OutcomesService();

    await expect(
      service.update('tenant-1', 'outcome-1', { version: 1, status: 'SUBMITTED' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(outcomeUpdate).not.toHaveBeenCalled();
  });

  it('rejects an unauthorized verifier assignment', async () => {
    outcomeFindFirst.mockResolvedValue(outcome());
    membershipFindFirst
      .mockResolvedValueOnce({ role: 'MANAGER' }) // acting user
      .mockResolvedValueOnce({ role: 'MANAGER' }); // verifier candidate — not authorized to verify
    const service = new OutcomesService();

    await expect(
      service.update(
        'tenant-1',
        'outcome-1',
        { version: 1, status: 'SUBMITTED', verifierId: 'user-2' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it.each([true, false])(
    'rejects assigning the creator, whether explicit or saved (explicit=%s)',
    async (explicit) => {
      outcomeFindFirst.mockResolvedValue(outcome({ verifierId: explicit ? null : 'user-1' }));
      membershipFindFirst.mockResolvedValue({ role: 'OWNER' });
      await expect(
        new OutcomesService().update(
          'tenant-1',
          'outcome-1',
          { version: 1, status: 'SUBMITTED', ...(explicit ? { verifierId: 'user-1' } : {}) },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(outcomeUpdate).not.toHaveBeenCalled();
    },
  );

  it('submits to an authorized verifier', async () => {
    outcomeFindFirst.mockResolvedValue(outcome());
    membershipFindFirst
      .mockResolvedValueOnce({ role: 'MANAGER' })
      .mockResolvedValueOnce({ role: 'REVIEWER' });
    outcomeUpdate.mockResolvedValue(outcome({ status: 'SUBMITTED', verifierId: 'user-2' }));
    const service = new OutcomesService();

    await service.update(
      'tenant-1',
      'outcome-1',
      { version: 1, status: 'SUBMITTED', verifierId: 'user-2' },
      'user-1',
    );

    expect(outcomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUBMITTED', verifierId: 'user-2' }),
      }),
    );
  });

  it('rejects an invalid transition', async () => {
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'VERIFIED' }));
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    const service = new OutcomesService();

    await expect(
      service.update(
        'tenant-1',
        'outcome-1',
        { version: 1, status: 'SUBMITTED', verifierId: 'user-2' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('OutcomesService.update — verifier reassignment', () => {
  beforeEach(() => {
    outcomeFindFirst.mockReset();
    outcomeUpdate.mockReset();
    membershipFindFirst.mockReset();
    recordAuditEvent.mockReset();
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'SUBMITTED', verifierId: 'user-1' }));
    membershipFindFirst
      .mockResolvedValueOnce({ role: 'OWNER' })
      .mockResolvedValueOnce({ role: 'REVIEWER' });
    outcomeUpdate.mockResolvedValue(
      outcome({ status: 'SUBMITTED', verifierId: 'user-2', version: 2 }),
    );
  });

  it('repairs a creator-assigned submitted outcome without changing its status, claim or evidence', async () => {
    const result = await new OutcomesService().update(
      'tenant-1',
      'outcome-1',
      { version: 1, verifierId: 'user-2' },
      'user-1',
    );
    expect(result.status).toBe('SUBMITTED');
    expect(outcomeUpdate).toHaveBeenCalledWith({
      where: { id: 'outcome-1', tenantId: 'tenant-1', version: 1 },
      data: { verifierId: 'user-2', updatedById: 'user-1', version: { increment: 1 } },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        action: 'outcome_verifier_changed',
        before: expect.objectContaining({ verifierId: 'user-1' }),
        after: expect.objectContaining({ verifierId: 'user-2' }),
      }),
    );
  });
  it.each(['REVIEWER', 'EXECUTIVE'])('denies reassignment by %s', async (role) => {
    membershipFindFirst.mockReset().mockResolvedValue({ role });
    await expect(
      new OutcomesService().update(
        'tenant-1',
        'outcome-1',
        { version: 1, verifierId: 'user-2' },
        'user-3',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(outcomeUpdate).not.toHaveBeenCalled();
  });
  it.each(['DRAFT', 'VERIFIED', 'REJECTED', 'VERIFICATION_REQUIRED'])(
    'keeps %s outcomes outside the reassignment path',
    async (status) => {
      outcomeFindFirst.mockResolvedValue(outcome({ status }));
      await expect(
        new OutcomesService().update(
          'tenant-1',
          'outcome-1',
          { version: 1, verifierId: 'user-2' },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(outcomeUpdate).not.toHaveBeenCalled();
    },
  );
  it('rejects the creator as replacement verifier', async () => {
    await expect(
      new OutcomesService().update(
        'tenant-1',
        'outcome-1',
        { version: 1, verifierId: 'user-1' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(outcomeUpdate).not.toHaveBeenCalled();
  });
  it('requires an active account and membership in this tenant', async () => {
    membershipFindFirst
      .mockReset()
      .mockResolvedValueOnce({ role: 'OWNER' })
      .mockResolvedValueOnce(null);
    await expect(
      new OutcomesService().update(
        'tenant-1',
        'outcome-1',
        { version: 1, verifierId: 'outside-or-disabled' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(membershipFindFirst).toHaveBeenLastCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'outside-or-disabled',
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
      },
    });
    expect(outcomeUpdate).not.toHaveBeenCalled();
  });
  it('retains optimistic concurrency when changing the verifier', async () => {
    outcomeUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    await expect(
      new OutcomesService().update(
        'tenant-1',
        'outcome-1',
        { version: 1, verifierId: 'user-2' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
  it('does not combine reassignment with a verification decision', async () => {
    await expect(
      new OutcomesService().update(
        'tenant-1',
        'outcome-1',
        { version: 1, status: 'VERIFIED', verifierId: 'user-2' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(outcomeUpdate).not.toHaveBeenCalled();
  });
});

describe('OutcomesService.update — verification (OUT-03, INV-003, T-009, T-010)', () => {
  beforeEach(() => {
    outcomeFindFirst.mockReset();
    outcomeUpdate.mockReset();
    membershipFindFirst.mockReset();
    evidenceCount.mockReset();
  });

  it('rejects verification without any linked evidence (T-009)', async () => {
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'SUBMITTED', verifierId: 'user-2' }));
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    evidenceCount.mockResolvedValue(0);
    const service = new OutcomesService();

    await expect(
      service.update('tenant-1', 'outcome-1', { version: 1, status: 'VERIFIED' }, 'user-2'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(outcomeUpdate).not.toHaveBeenCalled();
  });

  it('rejects the creator verifying their own outcome (T-010)', async () => {
    outcomeFindFirst.mockResolvedValue(
      outcome({ status: 'SUBMITTED', verifierId: 'user-1', createdById: 'user-1' }),
    );
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    const service = new OutcomesService();

    await expect(
      service.update('tenant-1', 'outcome-1', { version: 1, status: 'VERIFIED' }, 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(outcomeUpdate).not.toHaveBeenCalled();
  });

  it('rejects a Reviewer verifying an outcome they are not assigned to', async () => {
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'SUBMITTED', verifierId: 'user-2' }));
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    const service = new OutcomesService();

    await expect(
      service.update('tenant-1', 'outcome-1', { version: 1, status: 'VERIFIED' }, 'user-3'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(outcomeUpdate).not.toHaveBeenCalled();
  });

  it('allows the assigned Reviewer to verify an outcome with linked evidence', async () => {
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'SUBMITTED', verifierId: 'user-2' }));
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    evidenceCount.mockResolvedValue(1);
    outcomeUpdate.mockResolvedValue(outcome({ status: 'VERIFIED' }));
    const service = new OutcomesService();

    await service.update('tenant-1', 'outcome-1', { version: 1, status: 'VERIFIED' }, 'user-2');

    expect(outcomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'VERIFIED' }) }),
    );
  });

  it('allows an Admin to verify even when not the assigned verifier', async () => {
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'SUBMITTED', verifierId: 'user-2' }));
    membershipFindFirst.mockResolvedValue({ role: 'ADMIN' });
    evidenceCount.mockResolvedValue(1);
    outcomeUpdate.mockResolvedValue(outcome({ status: 'VERIFIED' }));
    const service = new OutcomesService();

    await service.update('tenant-1', 'outcome-1', { version: 1, status: 'VERIFIED' }, 'user-9');

    expect(outcomeUpdate).toHaveBeenCalled();
  });

  it('rejects rejection without a reason', async () => {
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'SUBMITTED', verifierId: 'user-2' }));
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    const service = new OutcomesService();

    await expect(
      service.update('tenant-1', 'outcome-1', { version: 1, status: 'REJECTED' }, 'user-2'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows requesting more evidence with a reason, and resubmitting afterward', async () => {
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'SUBMITTED', verifierId: 'user-2' }));
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    outcomeUpdate.mockResolvedValue(outcome({ status: 'VERIFICATION_REQUIRED' }));
    const service = new OutcomesService();

    await service.update(
      'tenant-1',
      'outcome-1',
      { version: 1, status: 'VERIFICATION_REQUIRED', verifierDisposition: 'Need more proof' },
      'user-2',
    );

    expect(outcomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'VERIFICATION_REQUIRED' }),
      }),
    );

    // Documented recovery move: VERIFICATION_REQUIRED -> SUBMITTED.
    outcomeFindFirst.mockResolvedValue(
      outcome({ status: 'VERIFICATION_REQUIRED', verifierId: 'user-2' }),
    );
    membershipFindFirst.mockReset();
    membershipFindFirst
      .mockResolvedValueOnce({ role: 'MANAGER' }) // acting user
      .mockResolvedValueOnce({ role: 'REVIEWER' }); // verifier being re-confirmed
    outcomeUpdate.mockResolvedValue(outcome({ status: 'SUBMITTED' }));

    await service.update('tenant-1', 'outcome-1', { version: 1, status: 'SUBMITTED' }, 'user-1');
    expect(outcomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUBMITTED' }) }),
    );
  });

  it('maps a version mismatch to ConflictException', async () => {
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'DRAFT' }));
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    outcomeUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new OutcomesService();

    await expect(
      service.update('tenant-1', 'outcome-1', { version: 1, claimedResult: 'x' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects editing plain fields once the outcome is no longer Draft', async () => {
    outcomeFindFirst.mockResolvedValue(outcome({ status: 'SUBMITTED', verifierId: 'user-2' }));
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    const service = new OutcomesService();

    await expect(
      service.update('tenant-1', 'outcome-1', { version: 1, claimedResult: 'New claim' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(outcomeUpdate).not.toHaveBeenCalled();
  });
});
