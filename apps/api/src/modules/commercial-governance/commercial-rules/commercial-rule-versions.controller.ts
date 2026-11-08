import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommercialRulesService } from './commercial-rules.service';
import { CreateCommercialRuleVersionDto } from './dto/create-commercial-rule-version.dto';
import { UpdateCommercialRuleVersionDto } from './dto/update-commercial-rule-version.dto';
import { TestCommercialRuleVersionDto } from './dto/test-commercial-rule-version.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// Same union-then-narrow shape as AgreementVersionsController — the
// service itself enforces which of drafting vs approving a given request
// may actually do.
const WRITE_OR_APPROVE_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'REVIEWER'] as const;

@ApiTags('commercial-rules')
@Controller('tenants/:tenantId/commercial-rules/:ruleId/versions')
@UseGuards(RoleGuard)
export class CommercialRuleVersionsController {
  constructor(private readonly commercialRulesService: CommercialRulesService) {}

  @Post()
  @RequireRole(...WRITE_OR_APPROVE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Draft a new commercial rule version (RULE-01).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: CreateCommercialRuleVersionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const commercialRuleVersion = await this.commercialRulesService.createVersion(
      tenantId,
      ruleId,
      dto,
      claims.sub,
    );
    return { commercialRuleVersion };
  }

  @Patch(':versionId')
  @RequireRole(...WRITE_OR_APPROVE_ROLES)
  @ApiOperation({
    summary: 'Edit a draft version or approve it (RULE-03) — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('ruleId') ruleId: string,
    @Param('versionId') versionId: string,
    @Body() dto: UpdateCommercialRuleVersionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const commercialRuleVersion = await this.commercialRulesService.updateVersion(
      tenantId,
      ruleId,
      versionId,
      dto,
      claims.sub,
    );
    return { commercialRuleVersion };
  }

  @Post(':versionId/test')
  @RequireRole(...WRITE_OR_APPROVE_ROLES)
  @ApiOperation({ summary: 'Test a rule version against sample cases (RULE-02).' })
  async test(
    @Param('tenantId') tenantId: string,
    @Param('ruleId') ruleId: string,
    @Param('versionId') versionId: string,
    @Body() dto: TestCommercialRuleVersionDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const commercialRuleVersion = await this.commercialRulesService.testVersion(
      tenantId,
      ruleId,
      versionId,
      dto,
      claims.sub,
    );
    return { commercialRuleVersion };
  }
}
