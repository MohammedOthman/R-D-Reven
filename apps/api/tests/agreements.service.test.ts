import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

const partnershipFindFirst = vi.fn();
const initiativeFindFirst = vi.fn();
const agreementFindFirst = vi.fn();
const agreementCreate = vi.fn();
const agreementUpdate = vi.fn();
const agreementVersionFindFirst = vi.fn();
const agreementVersionFindMany = vi.fn();
const agreementVersionCreate = vi.fn();
const agreementVersionUpdate = vi.fn();
const membershipFindFirst = vi.fn();
const transaction = vi.fn();

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
    agreement: {
      findFirst: (...args: unknown[]) => agreementFindFirst(...args),
      create: (...args: unknown[]) => agreementCreate(...args),
      update: (...args: unknown[]) => agreementUpdate(...args),
    },
    agreementVersion: {
      findFirst: (...args: unknown[]) => agreementVersionFindFirst(...args),
      findMany: (...args: unknown[]) => agreementVersionFindMany(...args),
      create: (...args: unknown[]) => agreementVersionCreate(...args),
      update: (...args: unknown[]) => agreementVersionUpdate(...args),
    },
    membership: { findFirst: (...args: unknown[]) => membershipFindFirst(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const { AgreementsService } = await import(
  '../src/modules/commercial-governance/agreements/agreements.service'
);

function agreement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agreement-1',
    tenantId: 'tenant-1',
    partnershipId: 'ship-1',
    sourceRef: null,
    status: 'CAPTURED',
    version: 1,
    ...overrides,
  };
}

function agreementVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'version-1',
    tenantId: 'tenant-1',
    agreementId: 'agreement-1',
    initiativeId: null,
    versionNumber: 1,
    terms: null,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    approvalStatus: 'DRAFT',
    version: 1,
    ...overrides,
  };
}

describe('AgreementsService.create', () => {
  beforeEach(() => {
    partnershipFindFirst.mockReset();
    agreementCreate.mockReset();
  });

  it('throws NotFoundException when the partnership does not exist', async () => {
    partnershipFindFirst.mockResolvedValue(null);
    const service = new AgreementsService();

    await expect(
      service.create('tenant-1', { partnershipId: 'missing' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(agreementCreate).not.toHaveBeenCalled();
  });

  it('creates an agreement in CAPTURED status', async () => {
    partnershipFindFirst.mockResolvedValue({ id: 'ship-1' });
    agreementCreate.mockResolvedValue(agreement());
    const service = new AgreementsService();

    await service.create('tenant-1', { partnershipId: 'ship-1' }, 'user-1');

    expect(agreementCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ partnershipId: 'ship-1' }) }),
    );
  });
});

describe('AgreementsService.update — status transitions', () => {
  beforeEach(() => {
    agreementFindFirst.mockReset();
    agreementUpdate.mockReset();
  });

  it('rejects an invalid transition', async () => {
    agreementFindFirst.mockResolvedValue(agreement({ status: 'EXPIRED' }));
    const service = new AgreementsService();

    await expect(
      service.update('tenant-1', 'agreement-1', { version: 1, status: 'EFFECTIVE' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(agreementUpdate).not.toHaveBeenCalled();
  });

  it('rejects setting AMENDED directly — only reachable via version approval', async () => {
    agreementFindFirst.mockResolvedValue(agreement({ status: 'EFFECTIVE' }));
    const service = new AgreementsService();

    await expect(
      service.update(
        'tenant-1',
        'agreement-1',
        // @ts-expect-error — AMENDED is intentionally excluded from the settable union.
        { version: 1, status: 'AMENDED' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows a valid transition', async () => {
    agreementFindFirst.mockResolvedValue(agreement({ status: 'CAPTURED' }));
    agreementUpdate.mockResolvedValue(agreement({ status: 'IN_REVIEW' }));
    const service = new AgreementsService();

    await service.update('tenant-1', 'agreement-1', { version: 1, status: 'IN_REVIEW' }, 'user-1');

    expect(agreementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'IN_REVIEW' }) }),
    );
  });

  it('maps a version mismatch to ConflictException', async () => {
    agreementFindFirst.mockResolvedValue(agreement({ status: 'CAPTURED' }));
    agreementUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new AgreementsService();

    await expect(
      service.update('tenant-1', 'agreement-1', { version: 1, status: 'IN_REVIEW' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('AgreementsService.createVersion', () => {
  beforeEach(() => {
    agreementFindFirst.mockReset();
    initiativeFindFirst.mockReset();
    agreementVersionFindFirst.mockReset();
    agreementVersionCreate.mockReset();
  });

  it('rejects adding a version to an EXPIRED agreement', async () => {
    agreementFindFirst.mockResolvedValue(agreement({ status: 'EXPIRED' }));
    const service = new AgreementsService();

    await expect(
      service.createVersion(
        'tenant-1',
        'agreement-1',
        { effectiveFrom: '2026-01-01' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(agreementVersionCreate).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the linked initiative does not exist', async () => {
    agreementFindFirst.mockResolvedValue(agreement({ status: 'CAPTURED' }));
    initiativeFindFirst.mockResolvedValue(null);
    const service = new AgreementsService();

    await expect(
      service.createVersion(
        'tenant-1',
        'agreement-1',
        { effectiveFrom: '2026-01-01', initiativeId: 'missing' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('numbers the first version 1, and a later one one past the last', async () => {
    agreementFindFirst.mockResolvedValue(agreement({ status: 'CAPTURED' }));
    agreementVersionFindFirst.mockResolvedValue({ versionNumber: 3 });
    agreementVersionCreate.mockResolvedValue(agreementVersion({ versionNumber: 4 }));
    const service = new AgreementsService();

    await service.createVersion('tenant-1', 'agreement-1', { effectiveFrom: '2026-01-01' }, 'user-1');

    expect(agreementVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ versionNumber: 4 }) }),
    );
  });
});

describe('AgreementsService.updateVersion — RBAC, immutability and overlap', () => {
  beforeEach(() => {
    agreementVersionFindFirst.mockReset();
    agreementVersionFindMany.mockReset();
    agreementVersionUpdate.mockReset();
    membershipFindFirst.mockReset();
    agreementFindFirst.mockReset();
    transaction.mockReset();
  });

  it('rejects a Manager trying to approve (only Owner/Admin/Reviewer may)', async () => {
    agreementVersionFindFirst.mockResolvedValue(agreementVersion());
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    const service = new AgreementsService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'agreement-1',
        'version-1',
        { version: 1, approvalStatus: 'APPROVED' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(agreementVersionUpdate).not.toHaveBeenCalled();
  });

  it('rejects a Reviewer trying to edit plain content (only Owner/Admin/Manager may)', async () => {
    agreementVersionFindFirst.mockResolvedValue(agreementVersion());
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    const service = new AgreementsService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'agreement-1',
        'version-1',
        { version: 1, terms: 'New terms' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects editing content on an already-approved version (INV-002)', async () => {
    agreementVersionFindFirst.mockResolvedValue(agreementVersion({ approvalStatus: 'APPROVED' }));
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    const service = new AgreementsService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'agreement-1',
        'version-1',
        { version: 1, terms: 'New terms' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects approving a version whose effective dates overlap an already-approved sibling', async () => {
    agreementVersionFindFirst.mockResolvedValue(
      agreementVersion({ effectiveFrom: new Date('2026-01-01'), effectiveTo: null }),
    );
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    agreementFindFirst.mockResolvedValue(agreement({ status: 'IN_REVIEW' }));
    agreementVersionFindMany.mockResolvedValue([
      agreementVersion({
        id: 'version-0',
        versionNumber: 0,
        approvalStatus: 'APPROVED',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: new Date('2027-01-01'),
      }),
    ]);
    const service = new AgreementsService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'agreement-1',
        'version-1',
        { version: 1, approvalStatus: 'APPROVED' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('approves a version and drives the parent agreement to EFFECTIVE atomically', async () => {
    agreementVersionFindFirst.mockResolvedValue(agreementVersion());
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    agreementFindFirst.mockResolvedValue(agreement({ status: 'IN_REVIEW' }));
    agreementVersionFindMany.mockResolvedValue([]);
    const approved = agreementVersion({ approvalStatus: 'APPROVED' });
    transaction.mockResolvedValue([approved, agreement({ status: 'EFFECTIVE' })]);
    const service = new AgreementsService();

    const result = await service.updateVersion(
      'tenant-1',
      'agreement-1',
      'version-1',
      { version: 1, approvalStatus: 'APPROVED' },
      'user-1',
    );

    expect(result).toEqual(approved);
    expect(transaction).toHaveBeenCalled();
  });

  it('rejects approval while the agreement is TERMINATED', async () => {
    agreementVersionFindFirst.mockResolvedValue(agreementVersion());
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    agreementFindFirst.mockResolvedValue(agreement({ status: 'TERMINATED' }));
    const service = new AgreementsService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'agreement-1',
        'version-1',
        { version: 1, approvalStatus: 'APPROVED' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('maps a version mismatch on plain edit to ConflictException', async () => {
    agreementVersionFindFirst.mockResolvedValue(agreementVersion());
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    agreementVersionUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new AgreementsService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'agreement-1',
        'version-1',
        { version: 1, terms: 'New terms' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
