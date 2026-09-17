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
const mkdir = vi.fn().mockResolvedValue(undefined);
const writeFile = vi.fn().mockResolvedValue(undefined);

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
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));

vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mkdir(...args),
  writeFile: (...args: unknown[]) => writeFile(...args),
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
    mkdir.mockClear();
    writeFile.mockClear();
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
    expect(writeFile).not.toHaveBeenCalled();
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
    expect(writeFile).not.toHaveBeenCalled();
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

    expect(writeFile).toHaveBeenCalled();
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
