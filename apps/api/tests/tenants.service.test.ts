import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';

const membershipFindFirst = vi.fn();
const tenantUpdate = vi.fn();
const tenantCreate = vi.fn();

vi.mock('@revn/db', () => ({
  prisma: {
    membership: { findFirst: (...args: unknown[]) => membershipFindFirst(...args) },
    tenant: {
      update: (...args: unknown[]) => tenantUpdate(...args),
      create: (...args: unknown[]) => tenantCreate(...args),
      findUnique: vi.fn().mockResolvedValue(null), // slug never taken, in these tests
    },
  },
}));

// Imported after the mock so the service picks up the mocked `prisma`.
const { TenantsService } = await import('../src/modules/identity-tenant/tenants/tenants.service');

describe('TenantsService.update', () => {
  beforeEach(() => {
    tenantUpdate.mockReset();
  });

  // Authorization (owner/admin only) is RoleGuard's job (see role.guard.test.ts)
  // — this only needs to prove the update itself is applied.
  it('applies the given fields to the tenant', async () => {
    tenantUpdate.mockResolvedValue({ id: 'tenant-1', name: 'New name' });
    const service = new TenantsService();

    const result = await service.update('tenant-1', { name: 'New name' });

    expect(result).toEqual({ id: 'tenant-1', name: 'New name' });
    expect(tenantUpdate).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { name: 'New name' },
    });
  });
});

describe('TenantsService.create', () => {
  beforeEach(() => {
    membershipFindFirst.mockReset();
    tenantCreate.mockReset();
  });

  it('rejects a user who already belongs to an organization', async () => {
    membershipFindFirst.mockResolvedValue({
      tenant: {
        id: 't1',
        name: 'Existing',
        slug: 'existing',
        timezone: 'Asia/Riyadh',
        locale: 'en',
      },
      role: 'OWNER',
    });
    const service = new TenantsService();

    await expect(service.create('New Org', 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tenantCreate).not.toHaveBeenCalled();
  });

  it('creates the tenant with the creator as OWNER when they have no existing membership', async () => {
    membershipFindFirst.mockResolvedValue(null);
    tenantCreate.mockResolvedValue({ id: 't2', name: 'New Org', slug: 'new-org' });
    const service = new TenantsService();

    const result = await service.create('New Org', 'user-1');

    expect(result.role).toBe('OWNER');
    expect(tenantCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'New Org',
          memberships: { create: { userId: 'user-1', role: 'OWNER', status: 'ACTIVE' } },
        }),
      }),
    );
  });
});
