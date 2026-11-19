import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// Account is part of the portfolio, so writes follow "Partnership edit":
// Owner/Admin/Manager. Reads are served by the Ecosystem graph route.
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('accounts')
@Controller('tenants/:tenantId/accounts')
@UseGuards(RoleGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a company to the ecosystem map.' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAccountDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const account = await this.accountsService.create(tenantId, dto, claims.sub);
    return { account };
  }
}
