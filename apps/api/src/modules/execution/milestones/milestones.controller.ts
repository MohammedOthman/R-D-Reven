import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// Same "Initiatives/actions" row as InitiativesController — a milestone is
// Initiative's own child object (see docs/DECISIONS.md), not a separate
// matrix row.
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('initiatives')
@Controller('tenants/:tenantId/initiatives/:initiativeId/milestones')
@UseGuards(RoleGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an ordered milestone under an initiative (INIT-02).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Param('initiativeId') initiativeId: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const milestone = await this.milestonesService.create(tenantId, initiativeId, dto, claims.sub);
    return { milestone };
  }

  @Patch(':milestoneId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary: 'Update a milestone or toggle its completion — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('initiativeId') initiativeId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const milestone = await this.milestonesService.update(
      tenantId,
      initiativeId,
      milestoneId,
      dto,
      claims.sub,
    );
    return { milestone };
  }
}
