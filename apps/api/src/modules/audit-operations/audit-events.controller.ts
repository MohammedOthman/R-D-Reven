import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Membership } from '@revn/db';
import type { FastifyReply } from 'fastify';
import { listAuditEvents, exportAuditEventsCsv } from './audit.service';
import { RoleGuard } from '../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentMembership } from '../identity-tenant/tenants/decorators/current-membership.decorator';

// §2.3's "Audit/export" row: Admin=Admin, Executive=Portfolio, Manager=Own
// scope, Reviewer=Assigned scope, Guest=No. Every non-Guest role is let
// through the guard — `listAuditEvents` itself narrows Manager/Reviewer to
// their own actor scope. See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;

@ApiTags('audit')
@Controller('tenants/:tenantId/audit-events')
@UseGuards(RoleGuard)
export class AuditEventsController {
  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Search the audit trail (AUD-02) — scoped by role per §2.3.' })
  async list(
    @Param('tenantId') tenantId: string,
    @CurrentMembership() membership: Membership,
    @Query('objectType') objectType?: string,
    @Query('objectId') objectId?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('correlationId') correlationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await listAuditEvents(
      tenantId,
      {
        objectType,
        objectId,
        actorId,
        action,
        correlationId,
        from,
        to,
        cursor,
        limit: limit ? Number(limit) : undefined,
      },
      { role: membership.role, userId: membership.userId },
    );
    return { events: result.events, nextCursor: result.nextCursor };
  }

  @Get('export.csv')
  @RequireRole(...READ_ROLES)
  @ApiOperation({
    summary:
      'Export the audit trail as CSV (AUD-03) — same filters and role scoping as the search above.',
  })
  async exportCsv(
    @Param('tenantId') tenantId: string,
    @CurrentMembership() membership: Membership,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('objectType') objectType?: string,
    @Query('objectId') objectId?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('correlationId') correlationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { csv } = await exportAuditEventsCsv(
      tenantId,
      { objectType, objectId, actorId, action, correlationId, from, to },
      { role: membership.role, userId: membership.userId },
    );
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="audit-events.csv"');
    return csv;
  }
}
