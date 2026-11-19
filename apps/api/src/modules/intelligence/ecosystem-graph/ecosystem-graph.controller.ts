import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EcosystemGraphService } from './ecosystem-graph.service';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// PRD §2.3 "Portfolio read" shape — everyone inside the tenant except Guest.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;
const ADMIN_ROLES = ['OWNER', 'ADMIN'] as const;

/**
 * The Ecosystem surface's read model. Accounts are tenant-owned; the graph is
 * derived. Example seeding is available only in the pilot and in local
 * development, never in the authenticated production app.
 */
@ApiTags('ecosystem')
@Controller('tenants/:tenantId/ecosystem')
@UseGuards(RoleGuard)
export class EcosystemGraphController {
  constructor(private readonly ecosystemGraphService: EcosystemGraphService) {}

  @Get('graph')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get the account ecosystem graph for this organization.' })
  async graph(@Param('tenantId') tenantId: string) {
    const graph = await this.ecosystemGraphService.getGraph(tenantId);
    return { graph };
  }

  @Get('accounts/:accountId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get one account with its closest accounts and linked partners.' })
  async account(@Param('tenantId') tenantId: string, @Param('accountId') accountId: string) {
    return this.ecosystemGraphService.getAccount(tenantId, accountId);
  }

  @Post('seed-example')
  @RequireRole(...ADMIN_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Load the example account graph (pilot and local development only).' })
  async seedExample(@Param('tenantId') tenantId: string, @CurrentUser() claims: JwtPayload) {
    if (process.env.PILOT_AUTO_LOGIN !== 'true' && process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    const result = await this.ecosystemGraphService.seedExample(tenantId, claims.sub);
    return { result };
  }

  @Post('rebuild')
  @RequireRole(...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recompute similarity edges from the current account data.' })
  async rebuild(@Param('tenantId') tenantId: string, @CurrentUser() claims: JwtPayload) {
    const result = await this.ecosystemGraphService.rebuild(tenantId, claims.sub);
    return { result };
  }
}
