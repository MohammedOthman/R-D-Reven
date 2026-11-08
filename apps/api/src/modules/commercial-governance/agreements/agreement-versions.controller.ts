import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgreementsService } from './agreements.service';
import { CreateAgreementVersionDto } from './dto/create-agreement-version.dto';
import { UpdateAgreementVersionDto } from './dto/update-agreement-version.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// The route accepts both drafters (Owner/Admin/Manager) and approvers
// (Owner/Admin/Reviewer) — AgreementsService itself enforces which of the
// two a given request may actually do, the same union-then-narrow shape
// DecisionsController uses for WRITE_OR_APPROVE_ROLES.
const WRITE_OR_APPROVE_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'REVIEWER'] as const;

@ApiTags('agreements')
@Controller('tenants/:tenantId/agreements/:agreementId/versions')
@UseGuards(RoleGuard)
export class AgreementVersionsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  @Post()
  @RequireRole(...WRITE_OR_APPROVE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Draft a new agreement version (AGR-02).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Param('agreementId') agreementId: string,
    @Body() dto: CreateAgreementVersionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const agreementVersion = await this.agreementsService.createVersion(
      tenantId,
      agreementId,
      dto,
      claims.sub,
    );
    return { agreementVersion };
  }

  @Patch(':versionId')
  @RequireRole(...WRITE_OR_APPROVE_ROLES)
  @ApiOperation({
    summary: 'Edit a draft version or approve it (AGR-02) — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('agreementId') agreementId: string,
    @Param('versionId') versionId: string,
    @Body() dto: UpdateAgreementVersionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const agreementVersion = await this.agreementsService.updateVersion(
      tenantId,
      agreementId,
      versionId,
      dto,
      claims.sub,
    );
    return { agreementVersion };
  }
}
