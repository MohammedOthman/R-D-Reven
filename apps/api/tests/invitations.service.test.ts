import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';

const invitationFindFirst = vi.fn();
const invitationCreate = vi.fn();
const invitationUpdate = vi.fn();

vi.mock('@revn/db', () => ({
  prisma: {
    invitation: {
      findFirst: (...args: unknown[]) => invitationFindFirst(...args),
      create: (...args: unknown[]) => invitationCreate(...args),
      update: (...args: unknown[]) => invitationUpdate(...args),
    },
  },
}));

const { InvitationsService } =
  await import('../src/modules/identity-tenant/invitations/invitations.service');

function buildService(existingUser: unknown = null) {
  const usersService = { findByEmail: vi.fn().mockResolvedValue(existingUser) };
  const mailerService = { sendInvitationEmail: vi.fn() };
  const service = new InvitationsService(usersService as never, mailerService as never);
  return { service, usersService, mailerService };
}

describe('InvitationsService.create', () => {
  beforeEach(() => {
    invitationFindFirst.mockReset();
    invitationCreate.mockReset();
    invitationUpdate.mockReset();
  });

  it('rejects inviting an email that already has an account', async () => {
    const { service } = buildService({ id: 'existing-user' });

    await expect(
      service.create('tenant-1', 'a@b.com', 'MANAGER', 'inviter-1', 'https://x/accept'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(invitationCreate).not.toHaveBeenCalled();
  });

  it('rejects a second invite while one is already pending for that email', async () => {
    const { service } = buildService(null);
    invitationFindFirst.mockResolvedValue({ id: 'existing-invite', status: 'PENDING' });

    await expect(
      service.create('tenant-1', 'a@b.com', 'MANAGER', 'inviter-1', 'https://x/accept'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(invitationCreate).not.toHaveBeenCalled();
  });

  it('creates the invitation and sends the email when nothing conflicts', async () => {
    const { service, mailerService } = buildService(null);
    invitationFindFirst.mockResolvedValue(null);
    invitationCreate.mockResolvedValue({ id: 'new-invite' });

    await service.create('tenant-1', 'A@B.com', 'MANAGER', 'inviter-1', 'https://x/accept');

    expect(invitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', email: 'a@b.com', role: 'MANAGER' }),
      }),
    );
    expect(mailerService.sendInvitationEmail).toHaveBeenCalledWith(
      'a@b.com',
      expect.stringContaining('https://x/accept?token='),
    );
  });
});

describe('InvitationsService.revoke', () => {
  beforeEach(() => {
    invitationFindFirst.mockReset();
    invitationUpdate.mockReset();
  });

  it('throws when the invitation does not belong to the tenant or is not pending', async () => {
    const { service } = buildService();
    invitationFindFirst.mockResolvedValue(null);

    await expect(service.revoke('tenant-1', 'invite-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(invitationUpdate).not.toHaveBeenCalled();
  });

  it('marks a pending invitation revoked', async () => {
    const { service } = buildService();
    invitationFindFirst.mockResolvedValue({ id: 'invite-1', status: 'PENDING' });
    invitationUpdate.mockResolvedValue({ id: 'invite-1', status: 'REVOKED' });

    await service.revoke('tenant-1', 'invite-1', 'user-1');

    expect(invitationUpdate).toHaveBeenCalledWith({
      where: { id: 'invite-1' },
      data: { status: 'REVOKED' },
    });
  });
});
