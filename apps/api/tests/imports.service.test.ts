import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

const importBatchFindFirst = vi.fn();
const importBatchCreate = vi.fn();
const importBatchUpdate = vi.fn();
const importRowFindMany = vi.fn();
const importRowCreateMany = vi.fn();
const importRowFindFirst = vi.fn();
const importRowUpdate = vi.fn();
const partnerFindMany = vi.fn();
const partnerCreate = vi.fn();
const partnerUpdate = vi.fn();
const partnershipCreate = vi.fn();
const membershipFindMany = vi.fn();
const transactionMock = vi.fn(async (arg: unknown) => {
  if (typeof arg === 'function') {
    return (arg as (tx: typeof txClient) => Promise<unknown>)(txClient);
  }
  return Promise.all(arg as Promise<unknown>[]);
});

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(`Prisma error ${code}`);
    this.code = code;
  }
}

const txClient = {
  partner: { create: (...args: unknown[]) => partnerCreate(...args) },
  partnership: { create: (...args: unknown[]) => partnershipCreate(...args) },
};

vi.mock('@revn/db', () => ({
  prisma: {
    importBatch: {
      findFirst: (...args: unknown[]) => importBatchFindFirst(...args),
      create: (...args: unknown[]) => importBatchCreate(...args),
      update: (...args: unknown[]) => importBatchUpdate(...args),
    },
    importRow: {
      findMany: (...args: unknown[]) => importRowFindMany(...args),
      createMany: (...args: unknown[]) => importRowCreateMany(...args),
      findFirst: (...args: unknown[]) => importRowFindFirst(...args),
      update: (...args: unknown[]) => importRowUpdate(...args),
    },
    partner: {
      findMany: (...args: unknown[]) => partnerFindMany(...args),
      create: (...args: unknown[]) => partnerCreate(...args),
      update: (...args: unknown[]) => partnerUpdate(...args),
    },
    partnership: {
      create: (...args: unknown[]) => partnershipCreate(...args),
    },
    membership: {
      findMany: (...args: unknown[]) => membershipFindMany(...args),
    },
    $transaction: (...args: unknown[]) =>
      (transactionMock as (...a: unknown[]) => Promise<unknown>)(...args),
  },
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const { ImportsService } = await import('../src/modules/portfolio/imports/imports.service');

function batch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'batch-1',
    tenantId: 'tenant-1',
    fileName: 'partners.csv',
    rowCount: 1,
    columnHeaders: ['Company', 'Domain'],
    fieldMapping: null,
    status: 'UPLOADED',
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    rejectedCount: 0,
    version: 1,
    ...overrides,
  };
}

function batchWithRows(overrides: Record<string, unknown> = {}) {
  return { ...batch(overrides), rows: [] };
}

describe('ImportsService.upload', () => {
  beforeEach(() => {
    importBatchCreate.mockReset();
    importRowCreateMany.mockReset();
    importBatchFindFirst.mockReset();
  });

  it('rejects a non-CSV mimetype', async () => {
    const service = new ImportsService();
    await expect(
      service.upload(
        'tenant-1',
        { filename: 'x.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x') },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(importBatchCreate).not.toHaveBeenCalled();
  });

  it('rejects a file with no data rows', async () => {
    const service = new ImportsService();
    await expect(
      service.upload(
        'tenant-1',
        { filename: 'x.csv', mimetype: 'text/csv', buffer: Buffer.from('Company,Domain\n') },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('stages a batch and its rows on a valid CSV', async () => {
    importBatchCreate.mockResolvedValue(batch());
    importBatchFindFirst.mockResolvedValue(batchWithRows());
    const service = new ImportsService();

    await service.upload(
      'tenant-1',
      {
        filename: 'x.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('Company,Domain\nAcme,acme.com\n'),
      },
      'user-1',
    );

    expect(importBatchCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          columnHeaders: ['Company', 'Domain'],
        }),
      }),
    );
    expect(importRowCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            rowNumber: 1,
            rawData: { Company: 'Acme', Domain: 'acme.com' },
          }),
        ],
      }),
    );
  });
});

describe('ImportsService.setMapping', () => {
  beforeEach(() => {
    importBatchFindFirst.mockReset();
    importRowFindMany.mockReset();
    partnerFindMany.mockReset();
    importBatchUpdate.mockReset();
    importRowUpdate.mockReset();
    transactionMock.mockClear();
  });

  it('rejects when legalName is not mapped', async () => {
    importBatchFindFirst.mockResolvedValue(batch());
    const service = new ImportsService();

    await expect(
      service.setMapping('tenant-1', 'batch-1', {
        version: 1,
        mapping: { displayName: 'Company' },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects mapping a committed batch', async () => {
    importBatchFindFirst.mockResolvedValue(batch({ status: 'COMMITTED' }));
    const service = new ImportsService();

    await expect(
      service.setMapping('tenant-1', 'batch-1', { version: 1, mapping: { legalName: 'Company' } }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('dispositions: missing legal name -> REJECT, exact name match -> UPDATE, domain overlap -> SKIP, new -> CREATE, in-batch duplicate -> SKIP', async () => {
    importBatchFindFirst.mockResolvedValue(batch());
    importRowFindMany.mockResolvedValue([
      { id: 'r1', rowNumber: 1, rawData: { Company: '', Domain: '' } },
      { id: 'r2', rowNumber: 2, rawData: { Company: 'Acme Ltd', Domain: '' } },
      { id: 'r3', rowNumber: 3, rawData: { Company: 'Globex', Domain: 'globex-existing.com' } },
      { id: 'r4', rowNumber: 4, rawData: { Company: 'Brand New Co', Domain: '' } },
      { id: 'r5', rowNumber: 5, rawData: { Company: 'Brand New Co', Domain: '' } },
    ]);
    partnerFindMany.mockResolvedValue([
      { id: 'p1', legalName: 'Acme Ltd', domains: [] },
      { id: 'p2', legalName: 'Globex Corp', domains: ['globex-existing.com'] },
    ]);
    importBatchUpdate.mockResolvedValue(batch({ status: 'MAPPED' }));
    importBatchFindFirst.mockResolvedValueOnce(batch()).mockResolvedValue(batchWithRows());
    const service = new ImportsService();

    await service.setMapping('tenant-1', 'batch-1', {
      version: 1,
      mapping: { legalName: 'Company', domains: 'Domain' },
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    const updateCalls = transactionMock.mock.calls[0]![0] as unknown[];
    expect(updateCalls).toHaveLength(5);

    expect(importBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdCount: 1,
          updatedCount: 1,
          skippedCount: 2,
          rejectedCount: 1,
        }),
      }),
    );
  });
});

describe('ImportsService.updateRow', () => {
  beforeEach(() => {
    importBatchFindFirst.mockReset();
    importRowFindFirst.mockReset();
    importRowUpdate.mockReset();
  });

  it('rejects forcing a row that is not SKIP', async () => {
    importBatchFindFirst.mockResolvedValue(batch({ status: 'MAPPED' }));
    importRowFindFirst.mockResolvedValue({ id: 'r1', disposition: 'CREATE' });
    const service = new ImportsService();

    await expect(service.updateRow('tenant-1', 'batch-1', 'r1', true)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(importRowUpdate).not.toHaveBeenCalled();
  });

  it('allows forcing a SKIP row', async () => {
    importBatchFindFirst.mockResolvedValue(batch({ status: 'MAPPED' }));
    importRowFindFirst.mockResolvedValue({ id: 'r1', disposition: 'SKIP' });
    const service = new ImportsService();

    await service.updateRow('tenant-1', 'batch-1', 'r1', true);
    expect(importRowUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { forceCreate: true },
    });
  });
});

describe('ImportsService.commit', () => {
  beforeEach(() => {
    importBatchFindFirst.mockReset();
    importRowFindMany.mockReset();
    membershipFindMany.mockReset();
    partnerCreate.mockReset();
    partnerUpdate.mockReset();
    partnershipCreate.mockReset();
    importRowUpdate.mockReset();
    importBatchUpdate.mockReset();
    transactionMock.mockClear();
  });

  it('is idempotent — a committed batch is returned as-is without reprocessing', async () => {
    importBatchFindFirst.mockResolvedValueOnce(batch({ status: 'COMMITTED' }));
    importBatchFindFirst.mockResolvedValueOnce(batchWithRows({ status: 'COMMITTED' }));
    const service = new ImportsService();

    await service.commit('tenant-1', 'batch-1', 'user-1');

    expect(membershipFindMany).not.toHaveBeenCalled();
    expect(importBatchUpdate).not.toHaveBeenCalled();
  });

  it('rejects committing before a mapping has been set', async () => {
    importBatchFindFirst.mockResolvedValue(batch({ status: 'UPLOADED' }));
    const service = new ImportsService();

    await expect(service.commit('tenant-1', 'batch-1', 'user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates a partner+partnership for CREATE rows and updates existing partners for UPDATE rows, skipping SKIP/REJECT', async () => {
    importBatchFindFirst.mockResolvedValueOnce(
      batch({ status: 'MAPPED', fieldMapping: { legalName: 'Company', domains: 'Domain' } }),
    );
    importRowFindMany.mockResolvedValue([
      {
        id: 'r1',
        rowNumber: 1,
        disposition: 'CREATE',
        rawData: { Company: 'New Co', Domain: '' },
        matchedPartnerId: null,
        forceCreate: false,
      },
      {
        id: 'r2',
        rowNumber: 2,
        disposition: 'UPDATE',
        rawData: { Company: 'Acme Ltd', Domain: 'acme.com' },
        matchedPartnerId: 'p1',
        forceCreate: false,
      },
      {
        id: 'r3',
        rowNumber: 3,
        disposition: 'SKIP',
        rawData: { Company: 'Dup Co', Domain: '' },
        matchedPartnerId: null,
        forceCreate: false,
      },
      {
        id: 'r4',
        rowNumber: 4,
        disposition: 'REJECT',
        rawData: { Company: '', Domain: '' },
        matchedPartnerId: null,
        forceCreate: false,
      },
    ]);
    membershipFindMany.mockResolvedValue([]);
    partnerCreate.mockResolvedValue({ id: 'new-partner' });
    partnershipCreate.mockResolvedValue({ id: 'new-partnership' });
    partnerUpdate.mockResolvedValue({ id: 'p1' });
    importBatchUpdate.mockResolvedValue(batch({ status: 'COMMITTED' }));
    importBatchFindFirst.mockResolvedValueOnce(batchWithRows({ status: 'COMMITTED' }));
    const service = new ImportsService();

    await service.commit('tenant-1', 'batch-1', 'user-1');

    expect(partnerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ legalName: 'New Co' }) }),
    );
    expect(partnerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', tenantId: 'tenant-1' } }),
    );
    expect(importBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMMITTED',
          createdCount: 1,
          updatedCount: 1,
          skippedCount: 1,
          rejectedCount: 1,
        }),
      }),
    );
  });

  it('honors forceCreate on a SKIP row, importing it as a create', async () => {
    importBatchFindFirst.mockResolvedValueOnce(
      batch({ status: 'MAPPED', fieldMapping: { legalName: 'Company' } }),
    );
    importRowFindMany.mockResolvedValue([
      {
        id: 'r1',
        rowNumber: 1,
        disposition: 'SKIP',
        rawData: { Company: 'Forced Co' },
        matchedPartnerId: 'p1',
        forceCreate: true,
      },
    ]);
    membershipFindMany.mockResolvedValue([]);
    partnerCreate.mockResolvedValue({ id: 'forced-partner' });
    partnershipCreate.mockResolvedValue({ id: 'forced-partnership' });
    importBatchUpdate.mockResolvedValue(batch({ status: 'COMMITTED' }));
    importBatchFindFirst.mockResolvedValueOnce(batchWithRows({ status: 'COMMITTED' }));
    const service = new ImportsService();

    await service.commit('tenant-1', 'batch-1', 'user-1');

    expect(partnerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ legalName: 'Forced Co' }) }),
    );
    expect(importBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdCount: 1, skippedCount: 0 }),
      }),
    );
  });
});
