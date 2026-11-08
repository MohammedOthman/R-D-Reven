import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DecisionsService } from '../decisions/decisions.service';
import { CreateDecisionDto } from '../decisions/dto/create-decision.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// §2.3 "Decisions" row: Manager (and Admin/Owner) can "Draft/record" — Executive's own cell is "Approve" only, so it's excluded from creation.
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('reviews')
@Controller('tenants/:tenantId/reviews/:reviewId/decisions')
@UseGuards(RoleGuard)
export class ReviewDecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a decision against a review (DEC-01).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: CreateDecisionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const decision = await this.decisionsService.createForReview(
      tenantId,
      reviewId,
      dto,
      claims.sub,
    );
    return { decision };
  }
}
