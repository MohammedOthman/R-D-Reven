import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@revn/db', () => ({
  prisma: {
    account: {
      findFirst: mocks.findFirst,
      create: mocks.create,
    },
  },
}));

vi.mock('../src/modules/audit-operations/audit.service', () => ({
  recordAuditEvent: mocks.audit,
}));

import { AccountsService } from '../src/modules/portfolio/accounts/accounts.service';

describe('AccountsService', () => {
  const service = new AccountsService();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.audit.mockResolvedValue(undefined);
  });

  it('rejects a second account with the same normalized domain', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create('tenant-1', { name: 'Acme', domain: 'https://www.Acme.com/path' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', normalizedDomain: 'acme.com' },
      select: { id: true },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('creates a tenant-owned account with normalized identity and an audit event', async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({
      id: 'account-1',
      tenantId: 'tenant-1',
      name: 'Acme',
      normalizedDomain: 'acme.com',
      domains: ['acme.com'],
    });

    const account = await service.create(
      'tenant-1',
      {
        name: '  Acme  ',
        domain: 'www.acme.com/about',
        headcount: 120,
        technologies: ['Salesforce'],
        keywords: ['payments'],
      },
      'user-1',
    );

    expect(account.id).toBe('account-1');
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        name: 'Acme',
        normalizedDomain: 'acme.com',
        domains: ['acme.com'],
        headcount: 120,
        technologies: ['Salesforce'],
        keywords: ['payments'],
        source: 'MANUAL',
        createdById: 'user-1',
        updatedById: 'user-1',
      }),
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        actorId: 'user-1',
        action: 'account_created',
        objectType: 'Account',
        objectId: 'account-1',
      }),
    );
  });

  it('keeps accounts with no domain distinct', async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: 'account-2', domains: [] });

    await service.create('tenant-1', { name: 'No Domain Co' }, 'user-1');

    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ normalizedDomain: null, domains: [] }),
    });
  });
});
