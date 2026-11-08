import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActionsService } from '../actions/actions.service';
import { CreateActionDto } from '../actions/dto/create-action.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

/** FLOW-B: "review owner records decisions and follow-ups" — a follow-up is just an Action linked to this Review instead of (or alongside) an Initiative. */
@ApiTags('reviews')
@Controller('tenants/:tenantId/reviews/:reviewId/actions')
@UseGuards(RoleGuard)
export class ReviewActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a follow-up action against a review (REV-05).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: CreateActionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const action = await this.actionsService.create(tenantId, { ...dto, reviewId }, claims.sub);
    return { action };
  }
}
