import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgreementsService } from './agreements.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// §2.3's "Agreements/rules" row: Admin=Admin, Executive=Read, Manager=
// Metadata, Reviewer=Review/approve, Guest=No by default (needs Share
// Grant, not built — v2 item 16). See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('agreements')
@Controller('tenants/:tenantId/agreements')
@UseGuards(RoleGuard)
export class AgreementsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List agreements — optionally scoped to a partnership.' })
  async list(@Param('tenantId') tenantId: string, @Query('partnershipId') partnershipId?: string) {
    const agreements = await this.agreementsService.list(tenantId, partnershipId);
    return { agreements };
  }

  @Get(':agreementId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get an agreement with its version history (S10 workspace).' })
  async get(@Param('tenantId') tenantId: string, @Param('agreementId') agreementId: string) {
    const agreement = await this.agreementsService.get(tenantId, agreementId);
    return { agreement };
  }

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an agreement under a partnership (AGR-01).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAgreementDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const agreement = await this.agreementsService.create(tenantId, dto, claims.sub);
    return { agreement };
  }

  @Patch(':agreementId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary: 'Edit an agreement or move it through a controlled status transition (AGR-05) — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('agreementId') agreementId: string,
    @Body() dto: UpdateAgreementDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const agreement = await this.agreementsService.update(tenantId, agreementId, dto, claims.sub);
    return { agreement };
  }
}
