import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Prisma, prisma, type AuditEvent, type MembershipRole } from '@revn/db';
import { toCsv } from '../../common/csv';

const logger = new Logger('AuditService');

export interface RecordAuditEventInput {
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string;
  before?: unknown;
  after?: unknown;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined
    ? undefined
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

/**
 * AUD-01: append a material event. A plain function, not a NestJS-injected
 * service — the same "singleton import, not constructor-injected" pattern
 * `prisma` itself already uses everywhere in this codebase, so calling this
 * from an existing service never changes that service's constructor
 * signature or breaks its existing unit tests.
 *
 * Never throws — an audit-write failure must not block the business
 * mutation it's describing (the mutation already succeeded by the time this
 * is called); a failure here is logged and swallowed instead.
 */
export async function recordAuditEvent(
  tenantId: string,
  input: RecordAuditEventInput,
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: input.actorId,
        action: input.action,
        objectType: input.objectType,
        objectId: input.objectId,
        before: toJson(input.before),
        after: toJson(input.after),
      },
    });
  } catch (error) {
    logger.warn(
      `Failed to record audit event action=${input.action} object=${input.objectType}/${input.objectId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export interface AuditEventFilters {
  objectType?: string;
  objectId?: string;
  actorId?: string;
  action?: string;
  correlationId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface AuditScope {
  role: MembershipRole;
  userId: string;
}

// §2.3's "Audit/export" row: Admin=Admin (full), Executive=Portfolio (full
// read), Manager=Own scope, Reviewer=Assigned scope, Guest=No. No generic
// cross-entity "assignment" resolver exists to compute "objects this
// Reviewer is assigned to" across every heterogeneous object type
// (Outcome.verifierId, Review.participantUserIds, ...) — "Assigned scope"
// is read as the same actor-filtered scope Manager's "Own scope" gets,
// documented in docs/DECISIONS.md, rather than built as a bespoke join per
// object type.
const FULL_READ_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'EXECUTIVE'];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
// AUD-03 / RPT-02's export has no pagination UI to page through, so it caps
// at a single, larger page rather than looping cursors indefinitely — a
// tenant with more audit events than this in scope needs real
// streaming/background export, deferred the same way RPT-03's
// report/export history tracking is. See docs/DECISIONS.md.
const EXPORT_LIMIT = 5000;

/** Shared by `listAuditEvents` and `exportCsv` so the two can never drift apart — T-022's own acceptance gate. */
function buildWhere(
  tenantId: string,
  filters: AuditEventFilters,
  scope: AuditScope,
): Record<string, unknown> {
  const where: Record<string, unknown> = { tenantId };
  if (filters.objectType) where.objectType = filters.objectType;
  if (filters.objectId) where.objectId = filters.objectId;
  if (filters.action) where.action = filters.action;
  if (filters.correlationId) where.correlationId = filters.correlationId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }

  if (FULL_READ_ROLES.includes(scope.role)) {
    if (filters.actorId) where.actorId = filters.actorId;
  } else {
    // Own/Assigned scope — the actor filter is forced, never widened by a
    // caller-supplied value.
    where.actorId = scope.userId;
  }
  return where;
}

export async function listAuditEvents(
  tenantId: string,
  filters: AuditEventFilters,
  scope: AuditScope,
): Promise<{ events: AuditEvent[]; nextCursor: string | null }> {
  const where = buildWhere(tenantId, filters, scope);

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  const lastEvent = page.at(-1);
  return { events: page, nextCursor: hasMore && lastEvent ? lastEvent.id : null };
}

/**
 * AUD-03 / RPT-02: export audit evidence for the caller's authorized scope
 * — the same `buildWhere` the search endpoint uses, so an export can never
 * show rows the search UI wouldn't. Logs `export_completed` itself (append-
 * only: exporting the audit log is, itself, a material event).
 */
export async function exportAuditEventsCsv(
  tenantId: string,
  filters: AuditEventFilters,
  scope: AuditScope,
): Promise<{ csv: string; recordCount: number }> {
  const startedAt = Date.now();
  const where = buildWhere(tenantId, filters, scope);
  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: EXPORT_LIMIT,
  });

  const headers = [
    'Time',
    'Actor ID',
    'Action',
    'Object Type',
    'Object ID',
    'Correlation ID',
    'Before',
    'After',
  ];
  const rows = events.map((e) => [
    e.createdAt.toISOString(),
    e.actorId ?? '',
    e.action,
    e.objectType,
    e.objectId,
    e.correlationId,
    e.before ? JSON.stringify(e.before) : '',
    e.after ? JSON.stringify(e.after) : '',
  ]);

  const exportId = randomUUID();
  logger.log(
    `export_completed export_id=${exportId} type=audit-events record_count=${events.length} filter_hash=${JSON.stringify(filters)} duration_ms=${Date.now() - startedAt}`,
  );
  await recordAuditEvent(tenantId, {
    actorId: scope.userId,
    action: 'export_completed',
    objectType: 'AuditEvent',
    objectId: exportId,
    after: { type: 'audit-events', recordCount: events.length, filters },
  });

  return { csv: toCsv(headers, rows), recordCount: events.length };
}

export async function getAuditEvent(
  tenantId: string,
  eventId: string,
  scope: AuditScope,
): Promise<AuditEvent | null> {
  const event = await prisma.auditEvent.findFirst({ where: { id: eventId, tenantId } });
  if (!event) return null;
  if (!FULL_READ_ROLES.includes(scope.role) && event.actorId !== scope.userId) {
    return null;
  }
  return event;
}
