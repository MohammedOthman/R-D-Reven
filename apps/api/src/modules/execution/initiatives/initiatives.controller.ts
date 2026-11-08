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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { InitiativesService } from './initiatives.service';
import { CreateInitiativeDto } from './dto/create-initiative.dto';
import { UpdateInitiativeDto } from './dto/update-initiative.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// PRD §2.3's "Initiatives/actions" row: Admin=Yes, Executive=Read, Manager=Yes,
// Reviewer=No, Guest="Shared items". Unlike Partnership, Reviewer has NO
// access here at all — a real, different row, not a borrowed shape. Guest's
// "shared items" needs the Share Grant mechanism (R1.1, not built) — no access.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER'] as const;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('initiatives')
@Controller('tenants/:tenantId/initiatives')
@UseGuards(RoleGuard)
export class InitiativesController {
  constructor(private readonly initiativesService: InitiativesService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List initiatives — optionally scoped to one partnership.' })
  async list(@Param('tenantId') tenantId: string, @Query('partnershipId') partnershipId?: string) {
    const initiatives = await this.initiativesService.list(tenantId, partnershipId);
    return { initiatives };
  }

  @Get('export.csv')
  @RequireRole(...READ_ROLES)
  @ApiOperation({
    summary:
      'Export initiatives this caller can see as CSV (RPT-02) — same rows as the list above, optionally scoped to one partnership.',
  })
  async exportCsv(
    @Param('tenantId') tenantId: string,
    @CurrentUser() claims: JwtPayload,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('partnershipId') partnershipId?: string,
  ) {
    const { csv } = await this.initiativesService.exportCsv(tenantId, claims.sub, partnershipId);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="initiatives.csv"');
    return csv;
  }

  @Get(':initiativeId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get an initiative with its milestones and actions (S07 workspace).' })
  async get(@Param('tenantId') tenantId: string, @Param('initiativeId') initiativeId: string) {
    const initiative = await this.initiativesService.get(tenantId, initiativeId);
    return { initiative };
  }

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an initiative under a partnership (INIT-01).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateInitiativeDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const initiative = await this.initiativesService.create(tenantId, dto, claims.sub);
    return { initiative };
  }

  @Patch(':initiativeId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary:
      'Update an initiative or move it through a controlled stage transition (INIT-06/07) — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('initiativeId') initiativeId: string,
    @Body() dto: UpdateInitiativeDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const initiative = await this.initiativesService.update(
      tenantId,
      initiativeId,
      dto,
      claims.sub,
    );
    return { initiative };
  }
}
