import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommercialRulesService } from './commercial-rules.service';
import { CreateCommercialRuleDto } from './dto/create-commercial-rule.dto';
import { UpdateCommercialRuleDto } from './dto/update-commercial-rule.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// Same "Agreements/rules" §2.3 row as AgreementsController — commercial
// rules are tenant-wide (Table 12 names no partnership field), so there is
// no partnershipId query filter here.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('commercial-rules')
@Controller('tenants/:tenantId/commercial-rules')
@UseGuards(RoleGuard)
export class CommercialRulesController {
  constructor(private readonly commercialRulesService: CommercialRulesService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List commercial rules for the tenant.' })
  async list(@Param('tenantId') tenantId: string) {
    const commercialRules = await this.commercialRulesService.list(tenantId);
    return { commercialRules };
  }

  @Get(':ruleId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get a commercial rule with its version history.' })
  async get(@Param('tenantId') tenantId: string, @Param('ruleId') ruleId: string) {
    const commercialRule = await this.commercialRulesService.get(tenantId, ruleId);
    return { commercialRule };
  }

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a commercial rule (eligibility or attribution).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateCommercialRuleDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const commercialRule = await this.commercialRulesService.create(tenantId, dto, claims.sub);
    return { commercialRule };
  }

  @Patch(':ruleId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({ summary: 'Rename a commercial rule — requires the last-read version.' })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateCommercialRuleDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const commercialRule = await this.commercialRulesService.update(tenantId, ruleId, dto, claims.sub);
    return { commercialRule };
  }
}
