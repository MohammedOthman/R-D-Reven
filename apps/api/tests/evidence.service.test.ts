import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

const contributionFindFirst = vi.fn();
const outcomeFindFirst = vi.fn();
const evidenceFindFirst = vi.fn();
const evidenceFindUnique = vi.fn();
const evidenceCreate = vi.fn();
const evidenceUpdate = vi.fn();
const evidenceFileCreate = vi.fn();
const evidenceFileFindFirst = vi.fn();
// Stands in for prisma.$transaction([...]): the service passes the already-
// built operations, so resolving them in order matches Prisma's contract.
const transaction = vi.fn((ops: Promise<unknown>[]) => Promise.all(ops));

vi.mock('@revn/db', () => ({
  prisma: {
    contribution: { findFirst: (...args: unknown[]) => contributionFindFirst(...args) },
    outcome: { findFirst: (...args: unknown[]) => outcomeFindFirst(...args) },
    evidence: {
      findFirst: (...args: unknown[]) => evidenceFindFirst(...args),
      findUnique: (...args: unknown[]) => evidenceFindUnique(...args),
      create: (...args: unknown[]) => evidenceCreate(...args),
      update: (...args: unknown[]) => evidenceUpdate(...args),
    },
    evidenceFile: {
      create: (...args: unknown[]) => evidenceFileCreate(...args),
      findFirst: (...args: unknown[]) => evidenceFileFindFirst(...args),
    },
    $transaction: (ops: Promise<unknown>[]) => transaction(ops),
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));

const { EvidenceService } =
  await import('../src/modules/evidence-outcomes/evidence/evidence.service');

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evidence-1',
    tenantId: 'tenant-1',
    contributionId: null,
    outcomeId: 'outcome-1',
    source: 'https://example.com/report.pdf',
    storageKey: null,
    classification: 'INTERNAL',
    ...overrides,
  };
}

describe('EvidenceService.create — EVD-02', () => {
  beforeEach(() => {
    contributionFindFirst.mockReset();
    outcomeFindFirst.mockReset();
    evidenceCreate.mockReset();
  });

  it('rejects evidence with no link at all', async () => {
    const service = new EvidenceService();

    await expect(
      service.create('tenant-1', { source: 'x', observedAt: '2026-01-01' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(evidenceCreate).not.toHaveBeenCalled();
  });

  it('rejects when the linked outcome does not exist', async () => {
    outcomeFindFirst.mockResolvedValue(null);
    const service = new EvidenceService();

    await expect(
      service.create(
        'tenant-1',
        { outcomeId: 'missing', source: 'x', observedAt: '2026-01-01' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates evidence linked directly to an outcome (INV-003)', async () => {
    outcomeFindFirst.mockResolvedValue({ id: 'outcome-1' });
    evidenceCreate.mockResolvedValue(evidence());
    const service = new EvidenceService();

    await service.create(
      'tenant-1',
      {
        outcomeId: 'outcome-1',
        source: 'https://example.com/report.pdf',
        observedAt: '2026-01-01',
      },
      'user-1',
    );

    expect(evidenceCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcomeId: 'outcome-1' }) }),
    );
  });
});

describe('EvidenceService.attachFile', () => {
  beforeEach(() => {
    evidenceFindFirst.mockReset();
    evidenceUpdate.mockReset();
    evidenceFileCreate.mockReset();
    evidenceFileCreate.mockResolvedValue({});
    transaction.mockClear();
  });

  it('rejects when the evidence already has a file (EVD-04)', async () => {
    evidenceFindFirst.mockResolvedValue(evidence({ storageKey: 'existing-key' }));
    const service = new EvidenceService();

    await expect(
      service.attachFile(
        'tenant-1',
        'evidence-1',
        { filename: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x') },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(evidenceFileCreate).not.toHaveBeenCalled();
  });

  it('rejects an unsupported mime type', async () => {
    evidenceFindFirst.mockResolvedValue(evidence());
    const service = new EvidenceService();

    await expect(
      service.attachFile(
        'tenant-1',
        'evidence-1',
        { filename: 'a.exe', mimetype: 'application/x-msdownload', buffer: Buffer.from('x') },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(evidenceFileCreate).not.toHaveBeenCalled();
  });

  it('stores the file and computes a checksum server-side', async () => {
    evidenceFindFirst.mockResolvedValue(evidence());
    evidenceUpdate.mockResolvedValue(evidence({ storageKey: 'x', checksum: 'abc' }));
    const service = new EvidenceService();

    await service.attachFile(
      'tenant-1',
      'evidence-1',
      { filename: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('hello') },
      'user-1',
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(evidenceFileCreate).toHaveBeenCalledWith({
      data: {
        storageKey: expect.stringMatching(/^evidence-1-\d+$/),
        tenantId: 'tenant-1',
        content: new Uint8Array(Buffer.from('hello')),
      },
    });
    expect(evidenceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: 'a.pdf',
          mimeType: 'application/pdf',
          checksum: expect.any(String),
        }),
      }),
    );
  });
});

describe('EvidenceService.replace — EVD-04', () => {
  beforeEach(() => {
    evidenceFindFirst.mockReset();
    evidenceFindUnique.mockReset();
    evidenceCreate.mockReset();
  });

  it('rejects replacing evidence that has already been replaced', async () => {
    evidenceFindFirst.mockResolvedValue(evidence());
    evidenceFindUnique.mockResolvedValue({ id: 'evidence-2' });
    const service = new EvidenceService();

    await expect(
      service.replace(
        'tenant-1',
        'evidence-1',
        { source: 'new source', observedAt: '2026-02-01' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(evidenceCreate).not.toHaveBeenCalled();
  });

  it('creates a new version pointing back at the one it replaces, never overwriting it', async () => {
    evidenceFindFirst.mockResolvedValue(evidence());
    evidenceFindUnique.mockResolvedValue(null);
    evidenceCreate.mockResolvedValue(
      evidence({ id: 'evidence-2', replacesEvidenceId: 'evidence-1' }),
    );
    const service = new EvidenceService();

    await service.replace(
      'tenant-1',
      'evidence-1',
      { source: 'new source', observedAt: '2026-02-01' },
      'user-1',
    );

    expect(evidenceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ replacesEvidenceId: 'evidence-1', source: 'new source' }),
      }),
    );
  });
});

describe('EvidenceService.getFile — tenant-scoped download', () => {
  beforeEach(() => {
    evidenceFindFirst.mockReset();
    evidenceFileFindFirst.mockReset();
  });
  it('does not look up bytes when the evidence is not in the caller’s tenant', async () => {
    evidenceFindFirst.mockResolvedValue(null);
    await expect(
      new EvidenceService().getFile('other-tenant', 'evidence-1', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(evidenceFindFirst).toHaveBeenCalledWith({
      where: { id: 'evidence-1', tenantId: 'other-tenant' },
    });
    expect(evidenceFileFindFirst).not.toHaveBeenCalled();
  });
  it('returns not-found when the evidence has no uploaded file', async () => {
    evidenceFindFirst.mockResolvedValue(evidence());
    await expect(
      new EvidenceService().getFile('tenant-1', 'evidence-1', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(evidenceFileFindFirst).not.toHaveBeenCalled();
  });
  it('requires the stored bytes to belong to the same tenant', async () => {
    evidenceFindFirst.mockResolvedValue(evidence({ storageKey: 'stored-file' }));
    evidenceFileFindFirst.mockResolvedValue(null);
    await expect(
      new EvidenceService().getFile('tenant-1', 'evidence-1', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(evidenceFileFindFirst).toHaveBeenCalledWith({
      where: { storageKey: 'stored-file', tenantId: 'tenant-1' },
    });
  });
  it('returns the original bytes and filename for an authorized reader', async () => {
    evidenceFindFirst.mockResolvedValue(
      evidence({ storageKey: 'stored-file', fileName: 'نتيجة.pdf' }),
    );
    evidenceFileFindFirst.mockResolvedValue({ content: new Uint8Array([1, 2, 3]) });
    await expect(
      new EvidenceService().getFile('tenant-1', 'evidence-1', 'user-1'),
    ).resolves.toEqual({ content: Buffer.from([1, 2, 3]), fileName: 'نتيجة.pdf' });
  });
});
