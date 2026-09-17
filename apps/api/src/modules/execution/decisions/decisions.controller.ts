import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DecisionsService } from './decisions.service';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// §2.3's real "Decisions" row: Admin=Configure, Executive=Approve,
// Manager=Draft/record, Reviewer=Read, Guest=No unless shared. Reviewer
// reads decisions even though Reviews/Initiatives deny Reviewer entirely —
// a real, different shape, not copied from either neighboring row.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;
// Union of "draft/record" (write) and "approve" — DecisionsService itself
// enforces which of the two a given request may actually do. See docs/DECISIONS.md.
const WRITE_OR_APPROVE_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE'] as const;

@ApiTags('decisions')
@Controller('tenants/:tenantId/decisions')
@UseGuards(RoleGuard)
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List decisions — optionally scoped to a partnership or review.' })
  async list(
    @Param('tenantId') tenantId: string,
    @Query('partnershipId') partnershipId?: string,
    @Query('reviewId') reviewId?: string,
  ) {
    const decisions = await this.decisionsService.list(tenantId, { partnershipId, reviewId });
    return { decisions };
  }

  @Get(':decisionId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get a single decision.' })
  async get(@Param('tenantId') tenantId: string, @Param('decisionId') decisionId: string) {
    const decision = await this.decisionsService.get(tenantId, decisionId);
    return { decision };
  }

  @Patch(':decisionId')
  @RequireRole(...WRITE_OR_APPROVE_ROLES)
  @ApiOperation({
    summary:
      'Edit a decision, or approve/reject one pending approval (DEC-02) — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('decisionId') decisionId: string,
    @Body() dto: UpdateDecisionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const decision = await this.decisionsService.update(tenantId, decisionId, dto, claims.sub);
    return { decision };
  }
}
