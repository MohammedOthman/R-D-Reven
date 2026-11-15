import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

const userFindUnique = vi.fn();
const userUpsert = vi.fn();
const tenantUpsert = vi.fn();
const membershipFindUnique = vi.fn();
const membershipUpsert = vi.fn();
const recordAuditEvent = vi.fn();
vi.mock('@revn/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
      upsert: (...args: unknown[]) => userUpsert(...args),
    },
    tenant: { upsert: (...args: unknown[]) => tenantUpsert(...args) },
    membership: {
      findUnique: (...args: unknown[]) => membershipFindUnique(...args),
      upsert: (...args: unknown[]) => membershipUpsert(...args),
    },
  },
}));
vi.mock('../src/modules/audit-operations/audit.service', () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
const { PilotService, PILOT_USER_EMAIL, PILOT_TENANT_SLUG, PILOT_PERSONAS } =
  await import('../src/modules/identity-tenant/auth/pilot.service');
const pilotTenant = { id: 'tenant-p', slug: PILOT_TENANT_SLUG, name: 'Reven Pilot' };
const tokens = { accessToken: 'a', refreshToken: 'r' };
function service() {
  const authService = { startSession: vi.fn().mockResolvedValue(tokens) };
  return { pilot: new PilotService(authService as never), authService };
}

describe('PilotService.startPilotSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tenantUpsert.mockResolvedValue(pilotTenant);
    userFindUnique.mockResolvedValue(null);
    userUpsert.mockImplementation(({ create }) => ({
      ...create,
      id: create.email,
      status: 'ACTIVE',
    }));
    membershipFindUnique.mockResolvedValue(null);
    membershipUpsert.mockImplementation(({ create }) => create);
  });

  it('prepares the whole team so the first visitor can assign a verifier, and signs in as Owner by default', async () => {
    const { pilot, authService } = service();
    const result = await pilot.startPilotSession();
    expect(userUpsert).toHaveBeenCalledTimes(3);
    for (const role of ['OWNER', 'EXECUTIVE', 'REVIEWER']) {
      expect(membershipUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ tenantId: 'tenant-p', role, status: 'ACTIVE' }),
        }),
      );
    }
    expect(authService.startSession).toHaveBeenCalledWith(
      expect.objectContaining({ email: PILOT_USER_EMAIL }),
    );
    expect(result.tokens).toEqual(tokens);
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
  });

  it.each(['EXECUTIVE', 'REVIEWER'] as const)(
    'switches to %s with a distinct identity in the same workspace',
    async (role) => {
      const { pilot, authService } = service();
      const result = await pilot.startPilotSession(role);
      expect(result.user.email).toBe(PILOT_PERSONAS[role].email);
      expect(result.user.email).not.toBe(PILOT_USER_EMAIL);
      expect(authService.startSession).toHaveBeenCalledWith(result.user);
    },
  );

  it('reuses existing users and memberships without changing their roles or passwords', async () => {
    userFindUnique.mockImplementation(({ where }) => ({
      id: where.email,
      email: where.email,
      status: 'ACTIVE',
    }));
    membershipFindUnique.mockImplementation(({ where }) => ({
      status: 'ACTIVE',
      role: Object.entries(PILOT_PERSONAS).find(
        ([, p]) => p.email === where.tenantId_userId.userId,
      )?.[0],
    }));
    const { pilot } = service();
    await pilot.startPilotSession();
    expect(userUpsert).not.toHaveBeenCalled();
    expect(membershipUpsert).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('does not reactivate a suspended pilot persona', async () => {
    membershipFindUnique.mockResolvedValue({ status: 'SUSPENDED', role: 'OWNER' });
    const { pilot, authService } = service();
    await expect(pilot.startPilotSession()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(membershipUpsert).not.toHaveBeenCalled();
    expect(authService.startSession).not.toHaveBeenCalled();
  });

  it('does not open a session for a disabled pilot account', async () => {
    userFindUnique.mockResolvedValue({ id: 'disabled', status: 'DISABLED' });
    const { pilot, authService } = service();
    await expect(pilot.startPilotSession()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.startSession).not.toHaveBeenCalled();
  });
});
