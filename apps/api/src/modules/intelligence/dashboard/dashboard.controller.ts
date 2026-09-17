import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';

// No PRD matrix row is named "Command Center" — US-006 traces it to
// PORT/RPT, so this borrows "Portfolio read"'s shape exactly (the same
// role set already used for Partner/Partnership lists): Admin/Executive/
// Manager full, Reviewer included ("Scoped" already simplified to full
// read elsewhere in this codebase), Guest excluded ("Shared only" needs
// the Share Grant mechanism, not built). See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;

@ApiTags('dashboard')
@Controller('tenants/:tenantId/dashboard')
@UseGuards(RoleGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({
    summary:
      'Command Center aggregation (S04) — KPIs, exceptions, reviews due, decisions, initiatives.',
  })
  async get(@Param('tenantId') tenantId: string) {
    return this.dashboardService.get(tenantId);
  }
}
