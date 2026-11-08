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
import { PartnershipsService } from './partnerships.service';
import { CreatePartnershipDto } from './dto/create-partnership.dto';
import { UpdatePartnershipDto } from './dto/update-partnership.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// PRD §2.3's "Partnership edit" is now a real matrix row (unlike Partner,
// which had to borrow it) — Admin/Manager: Yes, Executive: Approve, Reviewer:
// No, Guest: "Shared fields". Re-examined per docs/DECISIONS.md's note to do
// so rather than assuming Partner's answer, and it lands on the same shape:
// Executive's "Approve" isn't a workflow this phase builds (no approval
// object/flow exists), so Executive gets read-only, same as Partner's
// interpretation of its own "Approve" cell. Guest's "shared fields" depends
// on the Share Grant mechanism (R1.1, not built) — no access for now.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('partnerships')
@Controller('tenants/:tenantId/partners/:partnerId/partnership')
@UseGuards(RoleGuard)
export class PartnershipsController {
  constructor(private readonly partnershipsService: PartnershipsService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'Get the governed relationship for a partner, if one exists.' })
  async get(@Param('tenantId') tenantId: string, @Param('partnerId') partnerId: string) {
    const partnership = await this.partnershipsService.get(tenantId, partnerId);
    return { partnership };
  }

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a governed relationship for a partner (PORT-03).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Param('partnerId') partnerId: string,
    @Body() dto: CreatePartnershipDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const partnership = await this.partnershipsService.create(tenantId, partnerId, dto, claims.sub);
    return { partnership };
  }

  @Patch()
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary:
      'Update a partnership or move it through a controlled stage transition (PORT-04) — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('partnerId') partnerId: string,
    @Body() dto: UpdatePartnershipDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const partnership = await this.partnershipsService.update(tenantId, partnerId, dto, claims.sub);
    return { partnership };
  }
}
