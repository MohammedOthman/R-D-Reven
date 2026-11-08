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
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleGuard } from './guards/role.guard';
import { RequireRole } from './decorators/require-role.decorator';
import type { JwtPayload } from '../auth/jwt-payload.type';

function toPublicTenant(tenant: {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  locale: string;
}) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    timezone: tenant.timezone,
    locale: tenant.locale,
  };
}

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @ApiOperation({
    summary: "The signed-in user's organization and role, or null if they have none yet.",
  })
  async me(@CurrentUser() claims: JwtPayload) {
    const result = await this.tenantsService.findForUser(claims.sub);
    if (!result) return { tenant: null, role: null };
    return { tenant: toPublicTenant(result.tenant), role: result.role };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an organization — the creator becomes its owner.' })
  async create(@Body() dto: CreateTenantDto, @CurrentUser() claims: JwtPayload) {
    const result = await this.tenantsService.create(dto.name, claims.sub);
    return { tenant: toPublicTenant(result.tenant), role: result.role };
  }

  @Patch(':tenantId')
  @UseGuards(RoleGuard)
  @RequireRole('OWNER', 'ADMIN')
  @ApiOperation({ summary: "Update an organization's settings — owner/admin only." })
  async update(@Param('tenantId') tenantId: string, @Body() dto: UpdateTenantDto) {
    const tenant = await this.tenantsService.update(tenantId, dto);
    return { tenant: toPublicTenant(tenant) };
  }
}
