import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

const partnershipFindFirst = vi.fn();
const partnershipFindMany = vi.fn();
const partnershipCreate = vi.fn();
const partnershipUpdate = vi.fn();
const partnerFindFirst = vi.fn();
const partnerFindMany = vi.fn();
const userFindMany = vi.fn();

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(`Prisma error ${code}`);
    this.code = code;
  }
}

vi.mock('@revn/db', () => ({
  prisma: {
    partnership: {
      findFirst: (...args: unknown[]) => partnershipFindFirst(...args),
      findMany: (...args: unknown[]) => partnershipFindMany(...args),
      create: (...args: unknown[]) => partnershipCreate(...args),
      update: (...args: unknown[]) => partnershipUpdate(...args),
    },
    partner: {
      findFirst: (...args: unknown[]) => partnerFindFirst(...args),
      findMany: (...args: unknown[]) => partnerFindMany(...args),
    },
    user: {
      findMany: (...args: unknown[]) => userFindMany(...args),
    },
  },
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const { PartnershipsService } =
  await import('../src/modules/portfolio/partnerships/partnerships.service');

function baseline(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ship-1',
    partnerId: 'partner-1',
    tenantId: 'tenant-1',
    stage: 'PROSPECT',
    ownerId: null,
    sponsorId: null,
    motion: null,
    objective: null,
    cadence: null,
    health: null,
    nextReviewAt: null,
    lastTransitionReason: null,
    version: 1,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('PartnershipsService.create', () => {
  beforeEach(() => {
    partnerFindFirst.mockReset();
    partnershipCreate.mockReset();
  });

  it('throws NotFoundException when the partner does not exist in the tenant', async () => {
    partnerFindFirst.mockResolvedValue(null);
    const service = new PartnershipsService();

    await expect(service.create('tenant-1', 'missing', {}, 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(partnershipCreate).not.toHaveBeenCalled();
  });

  it('maps a duplicate partnership (unique partnerId) to ConflictException', async () => {
    partnerFindFirst.mockResolvedValue({ id: 'partner-1' });
    partnershipCreate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2002'));
    const service = new PartnershipsService();

    await expect(service.create('tenant-1', 'partner-1', {}, 'user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('starts at Prospect with no fields required', async () => {
    partnerFindFirst.mockResolvedValue({ id: 'partner-1' });
    partnershipCreate.mockResolvedValue(baseline());
    const service = new PartnershipsService();

    await service.create('tenant-1', 'partner-1', { motion: 'Co-sell' }, 'user-1');

    expect(partnershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          partnerId: 'partner-1',
          motion: 'Co-sell',
        }),
      }),
    );
  });
});

describe('PartnershipsService.update — stage transitions', () => {
  beforeEach(() => {
    partnershipFindFirst.mockReset();
    partnershipUpdate.mockReset();
  });

  it('throws NotFoundException when the partner has no partnership yet', async () => {
    partnershipFindFirst.mockResolvedValue(null);
    const service = new PartnershipsService();

    await expect(
      service.update('tenant-1', 'partner-1', { version: 1, stage: 'QUALIFIED' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a transition that skips a stage (Prospect -> Active)', async () => {
    partnershipFindFirst.mockResolvedValue(baseline({ stage: 'PROSPECT' }));
    const service = new PartnershipsService();

    await expect(
      service.update('tenant-1', 'partner-1', { version: 1, stage: 'ACTIVE' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(partnershipUpdate).not.toHaveBeenCalled();
  });

  it('rejects a transition out of a terminal Archived stage', async () => {
    partnershipFindFirst.mockResolvedValue(baseline({ stage: 'ARCHIVED' }));
    const service = new PartnershipsService();

    await expect(
      service.update('tenant-1', 'partner-1', { version: 1, stage: 'ACTIVE' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows Prospect -> Qualified once an owner is set', async () => {
    partnershipFindFirst.mockResolvedValue(baseline({ stage: 'PROSPECT' }));
    partnershipUpdate.mockResolvedValue(baseline({ stage: 'QUALIFIED', ownerId: 'user-9' }));
    const service = new PartnershipsService();

    await service.update(
      'tenant-1',
      'partner-1',
      { version: 1, stage: 'QUALIFIED', ownerId: 'user-9' },
      'user-1',
    );

    expect(partnershipUpdate).toHaveBeenCalled();
  });

  it('rejects Prospect -> Qualified without an owner (Table 67: owner required from Qualified)', async () => {
    partnershipFindFirst.mockResolvedValue(baseline({ stage: 'PROSPECT' }));
    const service = new PartnershipsService();

    await expect(
      service.update('tenant-1', 'partner-1', { version: 1, stage: 'QUALIFIED' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(partnershipUpdate).not.toHaveBeenCalled();
  });

  it('rejects activation without owner, motion, objective, cadence, health and next review (PRD invariant)', async () => {
    partnershipFindFirst.mockResolvedValue(
      baseline({ stage: 'PLANNING', ownerId: 'user-9', motion: 'Co-sell' }),
    );
    const service = new PartnershipsService();

    await expect(
      service.update('tenant-1', 'partner-1', { version: 1, stage: 'ACTIVE' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(partnershipUpdate).not.toHaveBeenCalled();
  });

  it('allows Planning -> Active once every readiness field is present', async () => {
    partnershipFindFirst.mockResolvedValue(
      baseline({
        stage: 'PLANNING',
        ownerId: 'user-9',
        motion: 'Co-sell',
        objective: 'Grow pipeline',
        cadence: 'Monthly',
      }),
    );
    partnershipUpdate.mockResolvedValue(baseline({ stage: 'ACTIVE' }));
    const service = new PartnershipsService();

    await service.update(
      'tenant-1',
      'partner-1',
      { version: 1, stage: 'ACTIVE', health: 'HEALTHY', nextReviewAt: '2026-02-01T00:00:00Z' },
      'user-1',
    );

    expect(partnershipUpdate).toHaveBeenCalled();
  });

  it('requires a transition reason moving into At Risk', async () => {
    partnershipFindFirst.mockResolvedValue(
      baseline({
        stage: 'ACTIVE',
        ownerId: 'user-9',
        motion: 'Co-sell',
        objective: 'Grow pipeline',
        cadence: 'Monthly',
        health: 'HEALTHY',
        nextReviewAt: new Date('2026-02-01T00:00:00Z'),
      }),
    );
    const service = new PartnershipsService();

    await expect(
      service.update('tenant-1', 'partner-1', { version: 1, stage: 'AT_RISK' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(partnershipUpdate).not.toHaveBeenCalled();
  });

  it('allows At Risk -> Active recovery (documented deviation from the literal forward-only chain)', async () => {
    partnershipFindFirst.mockResolvedValue(
      baseline({
        stage: 'AT_RISK',
        ownerId: 'user-9',
        motion: 'Co-sell',
        objective: 'Grow pipeline',
        cadence: 'Monthly',
        health: 'CRITICAL',
        nextReviewAt: new Date('2026-02-01T00:00:00Z'),
      }),
    );
    partnershipUpdate.mockResolvedValue(baseline({ stage: 'ACTIVE' }));
    const service = new PartnershipsService();

    await service.update('tenant-1', 'partner-1', { version: 1, stage: 'ACTIVE' }, 'user-1');

    expect(partnershipUpdate).toHaveBeenCalled();
  });

  it('allows terminating a Prospect relationship with no readiness fields set', async () => {
    partnershipFindFirst.mockResolvedValue(baseline({ stage: 'PROSPECT' }));
    partnershipUpdate.mockResolvedValue(baseline({ stage: 'TERMINATED' }));
    const service = new PartnershipsService();

    await service.update(
      'tenant-1',
      'partner-1',
      { version: 1, stage: 'TERMINATED', transitionReason: 'Deal fell through' },
      'user-1',
    );

    expect(partnershipUpdate).toHaveBeenCalled();
  });

  it('maps a version mismatch to ConflictException', async () => {
    partnershipFindFirst.mockResolvedValue(baseline({ stage: 'PROSPECT' }));
    partnershipUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new PartnershipsService();

    await expect(
      service.update('tenant-1', 'partner-1', { version: 1, motion: 'Co-sell' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PartnershipsService.exportCsv — RPT-02 / T-022', () => {
  beforeEach(() => {
    partnershipFindMany.mockReset();
    partnerFindMany.mockReset();
    userFindMany.mockReset();
  });

  it('produces a CSV row per partnership with joined partner and owner names', async () => {
    partnershipFindMany.mockResolvedValue([
      baseline({
        id: 'ship-1',
        partnerId: 'partner-1',
        stage: 'ACTIVE',
        health: 'HEALTHY',
        ownerId: 'user-1',
        sponsorId: null,
        motion: 'Co-sell',
        objective: 'Grow APAC',
        cadence: 'Monthly',
        nextReviewAt: new Date('2026-10-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ]);
    partnerFindMany.mockResolvedValue([
      { id: 'partner-1', displayName: 'Globex', segment: 'Manufacturing' },
    ]);
    userFindMany.mockResolvedValue([{ id: 'user-1', name: 'RBAC Owner' }]);

    const service = new PartnershipsService();
    const { csv, recordCount } = await service.exportCsv('tenant-1', 'user-1');

    expect(recordCount).toBe(1);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Partner,Segment,Stage,Health,Owner,Sponsor,Motion,Objective,Cadence,Next Review,Created At',
    );
    expect(lines[1]).toBe(
      'Globex,Manufacturing,ACTIVE,HEALTHY,RBAC Owner,,Co-sell,Grow APAC,Monthly,2026-10-01T00:00:00.000Z,2026-01-01T00:00:00.000Z',
    );
  });

  it('renders an empty row cleanly when a partnership has no owner/sponsor/health yet', async () => {
    partnershipFindMany.mockResolvedValue([
      baseline({
        id: 'ship-1',
        partnerId: 'partner-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ]);
    partnerFindMany.mockResolvedValue([{ id: 'partner-1', displayName: 'Acme', segment: null }]);
    userFindMany.mockResolvedValue([]);

    const service = new PartnershipsService();
    const { csv } = await service.exportCsv('tenant-1', 'user-1');

    expect(csv.split('\n')[1]).toBe('Acme,,PROSPECT,,,,,,,,2026-01-01T00:00:00.000Z');
  });

  it('exports zero rows as just the header when the tenant has no partnerships', async () => {
    partnershipFindMany.mockResolvedValue([]);
    partnerFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([]);

    const service = new PartnershipsService();
    const { csv, recordCount } = await service.exportCsv('tenant-1', 'user-1');

    expect(recordCount).toBe(0);
    expect(csv.split('\n')).toHaveLength(1);
  });
});
