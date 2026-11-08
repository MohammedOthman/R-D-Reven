import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('initiatives')
@Controller('tenants/:tenantId/initiatives/:initiativeId/actions')
@UseGuards(RoleGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create/assign an action under an initiative (INIT-03).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Param('initiativeId') initiativeId: string,
    @Body() dto: CreateActionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const action = await this.actionsService.create(tenantId, { ...dto, initiativeId }, claims.sub);
    return { action };
  }
}
