import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';

const partnerFindMany = vi.fn();
const partnerFindFirst = vi.fn();
const partnerCreate = vi.fn();
const partnerUpdate = vi.fn();

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(`Prisma error ${code}`);
    this.code = code;
  }
}

vi.mock('@revn/db', () => ({
  prisma: {
    partner: {
      findMany: (...args: unknown[]) => partnerFindMany(...args),
      findFirst: (...args: unknown[]) => partnerFindFirst(...args),
      create: (...args: unknown[]) => partnerCreate(...args),
      update: (...args: unknown[]) => partnerUpdate(...args),
    },
  },
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const { PartnersService } = await import('../src/modules/portfolio/partners/partners.service');

describe('PartnersService.create', () => {
  beforeEach(() => {
    partnerCreate.mockReset();
  });

  it('defaults displayName to legalName when omitted', async () => {
    partnerCreate.mockResolvedValue({ id: 'p1' });
    const service = new PartnersService();

    await service.create('tenant-1', { legalName: 'Acme Ltd' }, 'user-1');

    expect(partnerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ legalName: 'Acme Ltd', displayName: 'Acme Ltd' }),
      }),
    );
  });

  it('keeps a provided displayName distinct from legalName', async () => {
    partnerCreate.mockResolvedValue({ id: 'p1' });
    const service = new PartnersService();

    await service.create(
      'tenant-1',
      { legalName: 'Acme Legal Ltd', displayName: 'Acme' },
      'user-1',
    );

    expect(partnerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ legalName: 'Acme Legal Ltd', displayName: 'Acme' }),
      }),
    );
  });

  it('maps a unique-constraint violation to a ConflictException', async () => {
    partnerCreate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2002'));
    const service = new PartnersService();

    await expect(
      service.create('tenant-1', { legalName: 'Acme Ltd' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PartnersService.update', () => {
  beforeEach(() => {
    partnerFindFirst.mockReset();
    partnerUpdate.mockReset();
  });

  it('throws NotFoundException for a partner that does not exist in the tenant, before touching the version check', async () => {
    partnerFindFirst.mockResolvedValue(null);
    const service = new PartnersService();

    await expect(
      service.update('tenant-1', 'missing-id', { version: 1, segment: 'x' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(partnerUpdate).not.toHaveBeenCalled();
  });

  it('maps a version mismatch (no row matched the compound where) to ConflictException, not NotFoundException', async () => {
    partnerFindFirst.mockResolvedValue({ id: 'p1', version: 3 });
    partnerUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new PartnersService();

    await expect(
      service.update('tenant-1', 'p1', { version: 1, segment: 'x' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('increments the version and records who made the change on success', async () => {
    partnerFindFirst.mockResolvedValue({ id: 'p1', version: 1 });
    partnerUpdate.mockResolvedValue({ id: 'p1', version: 2 });
    const service = new PartnersService();

    await service.update('tenant-1', 'p1', { version: 1, segment: 'Fintech' }, 'user-2');

    expect(partnerUpdate).toHaveBeenCalledWith({
      where: { id: 'p1', tenantId: 'tenant-1', version: 1 },
      data: { segment: 'Fintech', updatedById: 'user-2', version: { increment: 1 } },
    });
  });

  it('maps a duplicate legalName on update to ConflictException', async () => {
    partnerFindFirst.mockResolvedValue({ id: 'p1', version: 1 });
    partnerUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2002'));
    const service = new PartnersService();

    await expect(
      service.update('tenant-1', 'p1', { version: 1, legalName: 'Taken' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
