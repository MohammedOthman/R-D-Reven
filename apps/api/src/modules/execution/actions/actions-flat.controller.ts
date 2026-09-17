import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActionsService } from './actions.service';
import { UpdateActionDto } from './dto/update-action.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

// Flat, not nested under initiatives — an action can belong to an
// initiative, a review, or (in principle) neither parent by the time it's
// being updated, so one update route serves every context rather than
// duplicating the same handler under two different parent paths.
@ApiTags('initiatives')
@Controller('tenants/:tenantId/actions')
@UseGuards(RoleGuard)
export class ActionsFlatController {
  constructor(private readonly actionsService: ActionsService) {}

  @Patch(':actionId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary:
      'Update an action — status, due date, blocker, completion note and evidence (INIT-04) — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('actionId') actionId: string,
    @Body() dto: UpdateActionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const action = await this.actionsService.update(tenantId, actionId, dto, claims.sub);
    return { action };
  }
}
