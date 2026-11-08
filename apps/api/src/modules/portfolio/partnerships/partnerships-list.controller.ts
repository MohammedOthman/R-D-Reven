import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { PartnershipsService } from './partnerships.service';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// Same "Portfolio read" shape as PartnersController/PartnershipsController —
// a separate controller class only because Nest controllers carry one fixed
// path prefix each, and this route (PORT-01's portfolio-wide list) sits at
// `.../partnerships`, not nested under a single `:partnerId`.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;

@ApiTags('partnerships')
@Controller('tenants/:tenantId/partnerships')
@UseGuards(RoleGuard)
export class PartnershipsListController {
  constructor(private readonly partnershipsService: PartnershipsService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List every governed relationship in this organization (PORT-01).' })
  async list(@Param('tenantId') tenantId: string) {
    const partnerships = await this.partnershipsService.listForTenant(tenantId);
    return { partnerships };
  }

  @Get('export.csv')
  @RequireRole(...READ_ROLES)
  @ApiOperation({
    summary:
      'Export every governed relationship this caller can see as CSV (RPT-02) — same rows as the list above.',
  })
  async exportCsv(
    @Param('tenantId') tenantId: string,
    @CurrentUser() claims: JwtPayload,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { csv } = await this.partnershipsService.exportCsv(tenantId, claims.sub);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="partnerships.csv"');
    return csv;
  }
}
