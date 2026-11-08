import { describe, expect, it, vi, beforeEach } from 'vitest';

const auditEventCreate = vi.fn();
const auditEventFindMany = vi.fn();
const auditEventFindFirst = vi.fn();

vi.mock('@revn/db', () => ({
  prisma: {
    auditEvent: {
      create: (...args: unknown[]) => auditEventCreate(...args),
      findMany: (...args: unknown[]) => auditEventFindMany(...args),
      findFirst: (...args: unknown[]) => auditEventFindFirst(...args),
    },
  },
}));

const { recordAuditEvent, listAuditEvents, getAuditEvent, exportAuditEventsCsv } =
  await import('../src/modules/audit-operations/audit.service');

describe('recordAuditEvent — AUD-01', () => {
  beforeEach(() => {
    auditEventCreate.mockReset();
  });

  it('appends an event with actor, object, action and before/after', async () => {
    auditEventCreate.mockResolvedValue({ id: 'event-1' });

    await recordAuditEvent('tenant-1', {
      actorId: 'user-1',
      action: 'outcome_verified',
      objectType: 'Outcome',
      objectId: 'outcome-1',
      before: { status: 'SUBMITTED' },
      after: { status: 'VERIFIED' },
    });

    expect(auditEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          actorId: 'user-1',
          action: 'outcome_verified',
          objectType: 'Outcome',
          objectId: 'outcome-1',
          before: { status: 'SUBMITTED' },
          after: { status: 'VERIFIED' },
        }),
      }),
    );
  });

  it('strips non-JSON-safe values (e.g. Date/Decimal) via a JSON round-trip', async () => {
    auditEventCreate.mockResolvedValue({ id: 'event-1' });

    await recordAuditEvent('tenant-1', {
      actorId: 'user-1',
      action: 'partnership_created',
      objectType: 'Partnership',
      objectId: 'ship-1',
      after: { id: 'ship-1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    });

    const call = auditEventCreate.mock.calls[0][0];
    expect(call.data.after).toEqual({ id: 'ship-1', createdAt: '2026-01-01T00:00:00.000Z' });
  });

  it('never throws — a write failure is caught and logged, not propagated', async () => {
    auditEventCreate.mockRejectedValue(new Error('db unavailable'));

    await expect(
      recordAuditEvent('tenant-1', {
        actorId: 'user-1',
        action: 'outcome_verified',
        objectType: 'Outcome',
        objectId: 'outcome-1',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('listAuditEvents — AUD-02, §2.3 "Audit/export" row scoping', () => {
  beforeEach(() => {
    auditEventFindMany.mockReset();
  });

  it('lets Owner/Admin/Executive read across every actor', async () => {
    auditEventFindMany.mockResolvedValue([]);

    await listAuditEvents(
      'tenant-1',
      { actorId: 'someone-else' },
      { role: 'EXECUTIVE', userId: 'user-1' },
    );

    expect(auditEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ actorId: 'someone-else' }),
      }),
    );
  });

  it('forces Manager to their own actor scope regardless of the requested filter', async () => {
    auditEventFindMany.mockResolvedValue([]);

    await listAuditEvents(
      'tenant-1',
      { actorId: 'someone-else' },
      { role: 'MANAGER', userId: 'user-1' },
    );

    expect(auditEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ actorId: 'user-1' }),
      }),
    );
  });

  it('forces Reviewer to their own actor scope ("Assigned scope")', async () => {
    auditEventFindMany.mockResolvedValue([]);

    await listAuditEvents('tenant-1', {}, { role: 'REVIEWER', userId: 'user-2' });

    expect(auditEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ actorId: 'user-2' }) }),
    );
  });

  it('paginates via take/cursor and reports nextCursor only when more rows exist', async () => {
    auditEventFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]);

    const result = await listAuditEvents(
      'tenant-1',
      { limit: 2 },
      { role: 'OWNER', userId: 'user-1' },
    );

    expect(auditEventFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
    expect(result.events).toHaveLength(2);
    expect(result.nextCursor).toBe('e2');
  });

  it('reports no nextCursor when the page is not full', async () => {
    auditEventFindMany.mockResolvedValue([{ id: 'e1' }]);

    const result = await listAuditEvents(
      'tenant-1',
      { limit: 2 },
      { role: 'OWNER', userId: 'user-1' },
    );

    expect(result.nextCursor).toBeNull();
  });
});

describe('getAuditEvent — row-level scoping for a single event', () => {
  beforeEach(() => {
    auditEventFindFirst.mockReset();
  });

  it("returns null (not the event) when a Manager requests someone else's event", async () => {
    auditEventFindFirst.mockResolvedValue({ id: 'event-1', actorId: 'someone-else' });

    const result = await getAuditEvent('tenant-1', 'event-1', {
      role: 'MANAGER',
      userId: 'user-1',
    });

    expect(result).toBeNull();
  });

  it('returns the event for Admin regardless of actor', async () => {
    auditEventFindFirst.mockResolvedValue({ id: 'event-1', actorId: 'someone-else' });

    const result = await getAuditEvent('tenant-1', 'event-1', { role: 'ADMIN', userId: 'user-1' });

    expect(result).toEqual({ id: 'event-1', actorId: 'someone-else' });
  });
});

describe('exportAuditEventsCsv — AUD-03 / RPT-02 / T-022', () => {
  beforeEach(() => {
    auditEventFindMany.mockReset();
    auditEventCreate.mockReset();
  });

  it('produces a CSV row per event, including flattened before/after JSON', async () => {
    auditEventFindMany.mockResolvedValue([
      {
        id: 'event-1',
        actorId: 'user-1',
        action: 'outcome_verified',
        objectType: 'Outcome',
        objectId: 'outcome-1',
        correlationId: 'corr-1',
        before: { status: 'SUBMITTED' },
        after: { status: 'VERIFIED' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const { csv, recordCount } = await exportAuditEventsCsv(
      'tenant-1',
      {},
      { role: 'OWNER', userId: 'user-1' },
    );

    expect(recordCount).toBe(1);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Time,Actor ID,Action,Object Type,Object ID,Correlation ID,Before,After');
    expect(lines[1]).toBe(
      '2026-01-01T00:00:00.000Z,user-1,outcome_verified,Outcome,outcome-1,corr-1,"{""status"":""SUBMITTED""}","{""status"":""VERIFIED""}"',
    );
  });

  it('forces Manager to their own actor scope, same as the search endpoint', async () => {
    auditEventFindMany.mockResolvedValue([]);

    await exportAuditEventsCsv(
      'tenant-1',
      { actorId: 'someone-else' },
      { role: 'MANAGER', userId: 'user-1' },
    );

    expect(auditEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ actorId: 'user-1' }) }),
    );
  });

  it('logs a real export_completed audit event for the export itself', async () => {
    auditEventFindMany.mockResolvedValue([]);
    auditEventCreate.mockResolvedValue({ id: 'export-event-1' });

    await exportAuditEventsCsv('tenant-1', {}, { role: 'OWNER', userId: 'user-1' });

    expect(auditEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'export_completed', objectType: 'AuditEvent' }),
      }),
    );
  });
});
