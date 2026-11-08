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
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { UpdateContributionDto } from './dto/update-contribution.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// §2.3's "Evidence/outcomes" row: Admin=Admin (full), Executive=Read,
// Manager=Create, Reviewer="Verify if assigned" (no separate Read cell —
// treated as full read here, the same simplification already applied to
// Portfolio read's "Scoped" cell for Reviewer), Guest="Contribute if
// granted" (needs the Share Grant mechanism, R1.1/not built — no access).
// See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('evidence-outcomes')
@Controller('tenants/:tenantId/contributions')
@UseGuards(RoleGuard)
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List contributions — optionally scoped to a linked object.' })
  async list(
    @Param('tenantId') tenantId: string,
    @Query('partnershipId') partnershipId?: string,
    @Query('initiativeId') initiativeId?: string,
    @Query('actionId') actionId?: string,
    @Query('outcomeId') outcomeId?: string,
  ) {
    const contributions = await this.contributionsService.list(tenantId, {
      partnershipId,
      initiativeId,
      actionId,
      outcomeId,
    });
    return { contributions };
  }

  @Get(':contributionId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get a single contribution with its evidence.' })
  async get(@Param('tenantId') tenantId: string, @Param('contributionId') contributionId: string) {
    const contribution = await this.contributionsService.get(tenantId, contributionId);
    return { contribution };
  }

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a contribution linked to a partnership, initiative, action or outcome (EVD-01).',
  })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateContributionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const contribution = await this.contributionsService.create(tenantId, dto, claims.sub);
    return { contribution };
  }

  @Patch(':contributionId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({ summary: 'Edit a contribution — requires the last-read version.' })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('contributionId') contributionId: string,
    @Body() dto: UpdateContributionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const contribution = await this.contributionsService.update(
      tenantId,
      contributionId,
      dto,
      claims.sub,
    );
    return { contribution };
  }
}
