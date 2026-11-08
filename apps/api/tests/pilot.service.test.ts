import { describe, expect, it, vi, beforeEach } from 'vitest';

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

const { PilotService, PILOT_USER_EMAIL, PILOT_TENANT_SLUG } =
  await import('../src/modules/identity-tenant/auth/pilot.service');

const pilotUser = { id: 'user-p', email: PILOT_USER_EMAIL, name: 'Pilot User' };
const pilotTenant = { id: 'tenant-p', slug: PILOT_TENANT_SLUG, name: 'Reven Pilot' };
const tokens = { accessToken: 'a', refreshToken: 'r' };

function service() {
  const authService = { startSession: vi.fn().mockResolvedValue(tokens) };
  return { pilot: new PilotService(authService as never), authService };
}

describe('PilotService.startPilotSession', () => {
  beforeEach(() => {
    for (const fn of [
      userFindUnique,
      userUpsert,
      tenantUpsert,
      membershipFindUnique,
      membershipUpsert,
      recordAuditEvent,
    ]) {
      fn.mockReset();
    }
    tenantUpsert.mockResolvedValue(pilotTenant);
  });

  it('creates the pilot user, organization and Owner membership on first use', async () => {
    userFindUnique.mockResolvedValue(null);
    userUpsert.mockResolvedValue(pilotUser);
    membershipFindUnique.mockResolvedValue(null);
    const { pilot, authService } = service();

    const result = await pilot.startPilotSession();

    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: PILOT_USER_EMAIL } }),
    );
    expect(tenantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: PILOT_TENANT_SLUG } }),
    );
    expect(membershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { tenantId: 'tenant-p', userId: 'user-p', role: 'OWNER', status: 'ACTIVE' },
      }),
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      'tenant-p',
      expect.objectContaining({ action: 'tenant_created' }),
    );
    expect(authService.startSession).toHaveBeenCalledWith(pilotUser);
    expect(result).toEqual({ user: pilotUser, tokens });
  });

  it('reuses everything on later visits and only opens a new session', async () => {
    userFindUnique.mockResolvedValue(pilotUser);
    membershipFindUnique.mockResolvedValue({ id: 'm-1' });
    const { pilot, authService } = service();

    await pilot.startPilotSession();

    expect(userUpsert).not.toHaveBeenCalled();
    expect(membershipUpsert).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
    expect(authService.startSession).toHaveBeenCalledWith(pilotUser);
  });
});
