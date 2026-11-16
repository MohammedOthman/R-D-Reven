import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { UpdateMemberDto } from './dto/update-member.dto';
import { RoleGuard } from '../tenants/guards/role.guard';
import { RequireRole } from '../tenants/decorators/require-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.type';

function toPublicMember(membership: {
  id: string;
  role: string;
  status: string;
  createdAt: Date;
  user: { id: string; name: string; email: string };
}) {
  return {
    id: membership.id,
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt,
    user: membership.user,
  };
}

// Same "Portfolio read" access as Partner/Partnership themselves — anyone
// who can see the portfolio needs to be able to pick an owner or sponsor
// from it, which the owner/admin-only member-management list below can't be
// opened up for without also exposing role/status management.
const DIRECTORY_READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'] as const;

@ApiTags('members')
@Controller('tenants/:tenantId/members')
@UseGuards(RoleGuard)
@RequireRole('OWNER', 'ADMIN')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({
    summary: 'List active and suspended members of an organization — owner/admin only.',
  })
  async list(@Param('tenantId') tenantId: string) {
    const members = await this.membersService.list(tenantId);
    return { members: members.map(toPublicMember) };
  }

  @Get('directory')
  @RequireRole(...DIRECTORY_READ_ROLES)
  @ApiOperation({
    summary:
      'List active members as id/name/email/role — for eligible assignee pickers, not member management.',
  })
  async directory(@Param('tenantId') tenantId: string) {
    const members = await this.membersService.directory(tenantId);
    return { members };
  }

  @Patch(':membershipId')
  @ApiOperation({ summary: "Change a member's role or status — owner/admin only." })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const membership = await this.membersService.update(tenantId, membershipId, dto, claims.sub);
    return { member: membership };
  }
}
