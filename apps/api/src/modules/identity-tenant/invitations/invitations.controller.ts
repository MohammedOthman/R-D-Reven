import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { RoleGuard } from '../tenants/guards/role.guard';
import { RequireRole } from '../tenants/decorators/require-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.type';
import type { Env } from '../../../common/config/env.validation';

@ApiTags('invitations')
@Controller('tenants/:tenantId/invitations')
@UseGuards(RoleGuard)
@RequireRole('OWNER', 'ADMIN')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List pending invitations — owner/admin only.' })
  async list(@Param('tenantId') tenantId: string) {
    const invitations = await this.invitationsService.list(tenantId);
    return {
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new teammate by email — owner/admin only.' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const webOrigin = this.configService.get('WEB_ORIGIN', { infer: true });
    await this.invitationsService.create(
      tenantId,
      dto.email,
      dto.role,
      claims.sub,
      `${webOrigin}/accept-invite`,
    );
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a pending invitation — owner/admin only.' })
  async revoke(
    @Param('tenantId') tenantId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() claims: JwtPayload,
  ) {
    await this.invitationsService.revoke(tenantId, invitationId, claims.sub);
  }
}
