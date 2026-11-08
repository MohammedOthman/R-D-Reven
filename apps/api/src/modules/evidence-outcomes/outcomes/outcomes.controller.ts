import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OutcomesService } from './outcomes.service';
import { CreateOutcomeDto } from './dto/create-outcome.dto';
import { UpdateOutcomeDto } from './dto/update-outcome.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// Same "Evidence/outcomes" row as Contributions/Evidence. The route accepts
// both creators (Owner/Admin/Manager) and verifiers (Owner/Admin/Reviewer) —
// OutcomesService itself enforces which of the two a given request may
// actually do, the same union-then-narrow shape DecisionsController uses
// for WRITE_OR_APPROVE_ROLES. See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'REVIEWER'] as const;

@ApiTags('evidence-outcomes')
@Controller('tenants/:tenantId/outcomes')
@UseGuards(RoleGuard)
export class OutcomesController {
  constructor(private readonly outcomesService: OutcomesService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List outcomes — optionally scoped to a partnership or initiative.' })
  async list(
    @Param('tenantId') tenantId: string,
    @Query('partnershipId') partnershipId?: string,
    @Query('initiativeId') initiativeId?: string,
  ) {
    const outcomes = await this.outcomesService.list(tenantId, { partnershipId, initiativeId });
    return { outcomes };
  }

  @Get(':outcomeId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get a single outcome.' })
  async get(@Param('tenantId') tenantId: string, @Param('outcomeId') outcomeId: string) {
    const outcome = await this.outcomesService.get(tenantId, outcomeId);
    return { outcome };
  }

  @Post()
  @RequireRole('OWNER', 'ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft outcome under a partnership (OUT-01).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateOutcomeDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const outcome = await this.outcomesService.create(tenantId, dto, claims.sub);
    return { outcome };
  }

  @Patch(':outcomeId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary:
      'Edit a draft outcome, submit it to a verifier, or record a verification decision (OUT-02/03) — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('outcomeId') outcomeId: string,
    @Body() dto: UpdateOutcomeDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const outcome = await this.outcomesService.update(tenantId, outcomeId, dto, claims.sub);
    return { outcome };
  }
}
