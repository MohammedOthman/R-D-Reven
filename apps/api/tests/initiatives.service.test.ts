import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

const initiativeFindFirst = vi.fn();
const initiativeFindMany = vi.fn();
const initiativeCreate = vi.fn();
const initiativeUpdate = vi.fn();
const partnershipFindFirst = vi.fn();
const partnershipFindMany = vi.fn();
const partnerFindMany = vi.fn();
const userFindMany = vi.fn();
const actionCount = vi.fn();
const actionUpdateMany = vi.fn();

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(`Prisma error ${code}`);
    this.code = code;
  }
}

const txClient = {
  initiative: { update: (...args: unknown[]) => initiativeUpdate(...args) },
  action: { updateMany: (...args: unknown[]) => actionUpdateMany(...args) },
};

vi.mock('@revn/db', () => ({
  prisma: {
    initiative: {
      findFirst: (...args: unknown[]) => initiativeFindFirst(...args),
      findMany: (...args: unknown[]) => initiativeFindMany(...args),
      create: (...args: unknown[]) => initiativeCreate(...args),
      update: (...args: unknown[]) => initiativeUpdate(...args),
    },
    partnership: {
      findFirst: (...args: unknown[]) => partnershipFindFirst(...args),
      findMany: (...args: unknown[]) => partnershipFindMany(...args),
    },
    partner: {
      findMany: (...args: unknown[]) => partnerFindMany(...args),
    },
    user: {
      findMany: (...args: unknown[]) => userFindMany(...args),
    },
    action: {
      count: (...args: unknown[]) => actionCount(...args),
      updateMany: (...args: unknown[]) => actionUpdateMany(...args),
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

const { InitiativesService } =
  await import('../src/modules/execution/initiatives/initiatives.service');

function initiative(overrides: Record<string, unknown> = {}) {
  return {
    id: 'init-1',
    tenantId: 'tenant-1',
    partnershipId: 'ship-1',
    objective: 'Grow pipeline',
    successMeasure: null,
    visibility: 'PRIVATE',
    health: null,
    ownerId: null,
    stage: 'DRAFT',
    completionDisposition: null,
    remainingActionsTreatment: null,
    completionOverrideReason: null,
    lastTransitionReason: null,
    completedAt: null,
    version: 1,
    ...overrides,
  };
}

describe('InitiativesService.create', () => {
  beforeEach(() => {
    partnershipFindFirst.mockReset();
    initiativeCreate.mockReset();
  });

  it('throws NotFoundException when the partnership does not exist in the tenant', async () => {
    partnershipFindFirst.mockResolvedValue(null);
    const service = new InitiativesService();

    await expect(
      service.create('tenant-1', { partnershipId: 'missing', objective: 'x' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(initiativeCreate).not.toHaveBeenCalled();
  });

  it('creates at Draft with the given objective and partnership', async () => {
    partnershipFindFirst.mockResolvedValue({ id: 'ship-1' });
    initiativeCreate.mockResolvedValue(initiative());
    const service = new InitiativesService();

    await service.create(
      'tenant-1',
      { partnershipId: 'ship-1', objective: 'Grow pipeline' },
      'user-1',
    );

    expect(initiativeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          partnershipId: 'ship-1',
          objective: 'Grow pipeline',
        }),
      }),
    );
  });
});

describe('InitiativesService.update — stage transitions', () => {
  beforeEach(() => {
    initiativeFindFirst.mockReset();
    initiativeUpdate.mockReset();
    actionCount.mockReset();
    actionUpdateMany.mockReset();
  });

  it('rejects a transition that skips a stage (Draft -> Active)', async () => {
    initiativeFindFirst.mockResolvedValue(initiative({ stage: 'DRAFT' }));
    const service = new InitiativesService();

    await expect(
      service.update('tenant-1', 'init-1', { version: 1, stage: 'ACTIVE' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(initiativeUpdate).not.toHaveBeenCalled();
  });

  it('rejects moving to Active without a success measure', async () => {
    initiativeFindFirst.mockResolvedValue(initiative({ stage: 'APPROVED' }));
    const service = new InitiativesService();

    await expect(
      service.update('tenant-1', 'init-1', { version: 1, stage: 'ACTIVE' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows Approved -> Active once a success measure is set', async () => {
    initiativeFindFirst.mockResolvedValue(initiative({ stage: 'APPROVED' }));
    initiativeUpdate.mockResolvedValue(initiative({ stage: 'ACTIVE' }));
    const service = new InitiativesService();

    await service.update(
      'tenant-1',
      'init-1',
      { version: 1, stage: 'ACTIVE', successMeasure: { type: 'revenue', target: 100 } },
      'user-1',
    );

    expect(initiativeUpdate).toHaveBeenCalled();
  });

  it('allows Blocked -> Active recovery', async () => {
    initiativeFindFirst.mockResolvedValue(
      initiative({ stage: 'BLOCKED', successMeasure: { type: 'revenue' } }),
    );
    initiativeUpdate.mockResolvedValue(initiative({ stage: 'ACTIVE' }));
    const service = new InitiativesService();

    await service.update('tenant-1', 'init-1', { version: 1, stage: 'ACTIVE' }, 'user-1');

    expect(initiativeUpdate).toHaveBeenCalled();
  });

  it('rejects completion without a completion disposition', async () => {
    initiativeFindFirst.mockResolvedValue(initiative({ stage: 'ACTIVE' }));
    const service = new InitiativesService();

    await expect(
      service.update(
        'tenant-1',
        'init-1',
        { version: 1, stage: 'COMPLETED', remainingActionsTreatment: 'LEAVE_OPEN' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects completion without a remaining-actions treatment', async () => {
    initiativeFindFirst.mockResolvedValue(initiative({ stage: 'ACTIVE' }));
    const service = new InitiativesService();

    await expect(
      service.update(
        'tenant-1',
        'init-1',
        { version: 1, stage: 'COMPLETED', completionDisposition: 'ACHIEVED' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects completion with an unresolved blocked action and no override (T-007)', async () => {
    initiativeFindFirst.mockResolvedValue(initiative({ stage: 'ACTIVE' }));
    actionCount.mockResolvedValue(1);
    const service = new InitiativesService();

    await expect(
      service.update(
        'tenant-1',
        'init-1',
        {
          version: 1,
          stage: 'COMPLETED',
          completionDisposition: 'ACHIEVED',
          remainingActionsTreatment: 'LEAVE_OPEN',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(initiativeUpdate).not.toHaveBeenCalled();
  });

  it('allows completion with a blocked action when an override reason is documented', async () => {
    initiativeFindFirst.mockResolvedValue(initiative({ stage: 'ACTIVE' }));
    actionCount.mockResolvedValue(1);
    initiativeUpdate.mockResolvedValue(initiative({ stage: 'COMPLETED' }));
    const service = new InitiativesService();

    await service.update(
      'tenant-1',
      'init-1',
      {
        version: 1,
        stage: 'COMPLETED',
        completionDisposition: 'ACHIEVED',
        remainingActionsTreatment: 'LEAVE_OPEN',
        completionOverrideReason: 'Partner deprioritized this workstream.',
      },
      'user-1',
    );

    expect(initiativeUpdate).toHaveBeenCalled();
  });

  it('cancels remaining open/in-progress actions when treatment is CANCEL_REMAINING', async () => {
    initiativeFindFirst.mockResolvedValue(initiative({ stage: 'ACTIVE' }));
    actionCount.mockResolvedValue(0);
    initiativeUpdate.mockResolvedValue(initiative({ stage: 'COMPLETED' }));
    const service = new InitiativesService();

    await service.update(
      'tenant-1',
      'init-1',
      {
        version: 1,
        stage: 'COMPLETED',
        completionDisposition: 'ACHIEVED',
        remainingActionsTreatment: 'CANCEL_REMAINING',
      },
      'user-1',
    );

    expect(actionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['OPEN', 'IN_PROGRESS'] } }),
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });

  it('maps a version mismatch to ConflictException', async () => {
    initiativeFindFirst.mockResolvedValue(initiative({ stage: 'DRAFT' }));
    initiativeUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new InitiativesService();

    await expect(
      service.update('tenant-1', 'init-1', { version: 1, objective: 'New text' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('InitiativesService.exportCsv — RPT-02 / T-022', () => {
  beforeEach(() => {
    initiativeFindMany.mockReset();
    partnershipFindMany.mockReset();
    partnerFindMany.mockReset();
    userFindMany.mockReset();
  });

  it('produces a CSV row per initiative with the joined partner and owner names', async () => {
    initiativeFindMany.mockResolvedValue([
      {
        id: 'init-1',
        partnershipId: 'ship-1',
        objective: 'Grow APAC pipeline',
        stage: 'ACTIVE',
        health: 'HEALTHY',
        ownerId: 'user-1',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        targetDate: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    partnershipFindMany.mockResolvedValue([{ id: 'ship-1', partnerId: 'partner-1' }]);
    partnerFindMany.mockResolvedValue([{ id: 'partner-1', displayName: 'Globex' }]);
    userFindMany.mockResolvedValue([{ id: 'user-1', name: 'RBAC Owner' }]);

    const service = new InitiativesService();
    const { csv, recordCount } = await service.exportCsv('tenant-1', 'user-1');

    expect(recordCount).toBe(1);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Partner,Objective,Stage,Health,Owner,Start Date,Target Date,Created At');
    expect(lines[1]).toBe(
      'Globex,Grow APAC pipeline,ACTIVE,HEALTHY,RBAC Owner,2026-01-01T00:00:00.000Z,2026-06-01T00:00:00.000Z,2026-01-01T00:00:00.000Z',
    );
  });

  it('passes the partnershipId filter straight through to the underlying list query', async () => {
    initiativeFindMany.mockResolvedValue([]);
    partnershipFindMany.mockResolvedValue([]);
    partnerFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([]);

    const service = new InitiativesService();
    await service.exportCsv('tenant-1', 'user-1', 'ship-1');

    expect(initiativeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1', partnershipId: 'ship-1' } }),
    );
  });
});
