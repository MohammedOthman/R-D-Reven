import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// PRD §2.3's matrix has no row named "Partner" specifically — only
// "Portfolio read" (Yes for Admin/Executive/Manager, "Scoped" for Reviewer,
// "Shared only" for Guest) and "Partnership edit" (Yes/Approve/Yes/No/Shared
// fields). Guest's "shared only" depends on the Share Grant mechanism
// (R1.1, not built) — treated as no access for now rather than inventing a
// partial-access shape nothing can populate yet. Write follows "Partnership
// edit"'s shape: Owner/Admin/Manager write, Executive's "Approve" isn't a
// workflow this phase builds, Reviewer/Guest are read-only. See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('partners')
@Controller('tenants/:tenantId/partners')
@UseGuards(RoleGuard)
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List partners for this organization.' })
  async list(@Param('tenantId') tenantId: string) {
    const partners = await this.partnersService.list(tenantId);
    return { partners };
  }

  @Get(':partnerId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get a single partner.' })
  async get(@Param('tenantId') tenantId: string, @Param('partnerId') partnerId: string) {
    const partner = await this.partnersService.get(tenantId, partnerId);
    return { partner };
  }

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a partner.' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreatePartnerDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const partner = await this.partnersService.create(tenantId, dto, claims.sub);
    return { partner };
  }

  @Patch(':partnerId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary: 'Update a partner — requires the last-read version (PRD §4.1 optimistic concurrency).',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('partnerId') partnerId: string,
    @Body() dto: UpdatePartnerDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const partner = await this.partnersService.update(tenantId, partnerId, dto, claims.sub);
    return { partner };
  }
}
