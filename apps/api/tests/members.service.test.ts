import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';

const membershipFindFirst = vi.fn();
const membershipCount = vi.fn();
const membershipUpdate = vi.fn();
const membershipFindMany = vi.fn();

vi.mock('@revn/db', () => ({
  prisma: {
    membership: {
      findMany: (...args: unknown[]) => membershipFindMany(...args),
      findFirst: (...args: unknown[]) => membershipFindFirst(...args),
      count: (...args: unknown[]) => membershipCount(...args),
      update: (...args: unknown[]) => membershipUpdate(...args),
    },
  },
}));

const { MembersService } = await import('../src/modules/identity-tenant/members/members.service');

describe('MembersService.directory', () => {
  it('returns roles for eligible assignment while excluding disabled accounts and inactive memberships', async () => {
    membershipFindMany.mockResolvedValue([
      { role: 'REVIEWER', user: { id: 'r1', name: 'Reviewer', email: 'reviewer@test.example' } },
    ]);
    const result = await new MembersService().directory('tenant-1');
    expect(membershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', status: 'ACTIVE', user: { status: 'ACTIVE' } },
      }),
    );
    expect(result).toEqual([
      { id: 'r1', name: 'Reviewer', email: 'reviewer@test.example', role: 'REVIEWER' },
    ]);
  });
});

describe('MembersService.update — last-active-owner invariant (ADM-03)', () => {
  beforeEach(() => {
    membershipFindFirst.mockReset();
    membershipCount.mockReset();
    membershipUpdate.mockReset();
  });

  it('throws when the target membership does not belong to the tenant', async () => {
    membershipFindFirst.mockResolvedValue(null);
    const service = new MembersService();

    await expect(
      service.update('tenant-1', 'membership-1', { role: 'ADMIN' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects demoting the sole active owner', async () => {
    membershipFindFirst.mockResolvedValue({ id: 'm1', role: 'OWNER', status: 'ACTIVE' });
    membershipCount.mockResolvedValue(0); // no other active owners

    const service = new MembersService();
    await expect(
      service.update('tenant-1', 'm1', { role: 'ADMIN' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(membershipUpdate).not.toHaveBeenCalled();
  });

  it('rejects suspending the sole active owner', async () => {
    membershipFindFirst.mockResolvedValue({ id: 'm1', role: 'OWNER', status: 'ACTIVE' });
    membershipCount.mockResolvedValue(0);

    const service = new MembersService();
    await expect(
      service.update('tenant-1', 'm1', { status: 'SUSPENDED' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows demoting an owner when another active owner exists', async () => {
    membershipFindFirst.mockResolvedValue({ id: 'm1', role: 'OWNER', status: 'ACTIVE' });
    membershipCount.mockResolvedValue(1); // one other active owner
    membershipUpdate.mockResolvedValue({ id: 'm1', role: 'ADMIN' });

    const service = new MembersService();
    await expect(service.update('tenant-1', 'm1', { role: 'ADMIN' }, 'user-1')).resolves.toEqual({
      id: 'm1',
      role: 'ADMIN',
    });
  });

  it('allows changing a non-owner freely without checking the owner count', async () => {
    membershipFindFirst.mockResolvedValue({ id: 'm2', role: 'MANAGER', status: 'ACTIVE' });
    membershipUpdate.mockResolvedValue({ id: 'm2', role: 'REVIEWER' });

    const service = new MembersService();
    await expect(service.update('tenant-1', 'm2', { role: 'REVIEWER' }, 'user-1')).resolves.toEqual(
      {
        id: 'm2',
        role: 'REVIEWER',
      },
    );
    expect(membershipCount).not.toHaveBeenCalled();
  });

  it('allows editing an already-suspended owner (no active ownership to lose)', async () => {
    membershipFindFirst.mockResolvedValue({ id: 'm1', role: 'OWNER', status: 'SUSPENDED' });
    membershipUpdate.mockResolvedValue({ id: 'm1', role: 'ADMIN', status: 'SUSPENDED' });

    const service = new MembersService();
    await expect(
      service.update('tenant-1', 'm1', { role: 'ADMIN' }, 'user-1'),
    ).resolves.toBeDefined();
    expect(membershipCount).not.toHaveBeenCalled();
  });
});
