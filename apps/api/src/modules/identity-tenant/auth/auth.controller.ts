import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { PilotService } from './pilot.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AcceptInvitationDto } from '../invitations/dto/accept-invitation.dto';
import { setAuthCookies, clearAuthCookies, type CookieOptions } from './auth.cookies';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import type { JwtPayload } from './jwt-payload.type';
import type { Env } from '../../../common/config/env.validation';

function toPublicUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<Env, true>,
    private readonly pilotService: PilotService,
  ) {}

  @Public()
  @Post('pilot-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pilot mode only: sign in as the shared pilot user. 404 unless PILOT_AUTO_LOGIN=true.',
  })
  async pilotSession(@Res({ passthrough: true }) reply: FastifyReply) {
    if (!this.configService.get('PILOT_AUTO_LOGIN', { infer: true })) {
      throw new NotFoundException();
    }
    const { user, tokens } = await this.pilotService.startPilotSession();
    setAuthCookies(reply, tokens, this.cookieOptions());
    return { user: toPublicUser(user) };
  }

  private cookieOptions(): CookieOptions {
    return {
      domain: this.configService.get('COOKIE_DOMAIN', { infer: true }),
      secure: this.configService.get('NODE_ENV', { infer: true }) === 'production',
    };
  }

  @Public()
  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an account and start a session.' })
  async signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { user, tokens } = await this.authService.signUp(dto.email, dto.password, dto.name);
    setAuthCookies(reply, tokens, this.cookieOptions());
    return { user: toPublicUser(user) };
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and start a session.' })
  async signIn(@Body() dto: SignInDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { user, tokens } = await this.authService.signIn(dto.email, dto.password);
    setAuthCookies(reply, tokens, this.cookieOptions());
    return { user: toPublicUser(user) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and mint a new access token.' })
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const rawRefreshToken = request.cookies[REFRESH_TOKEN_COOKIE];
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Session expired or invalid.');
    }
    const { user, tokens } = await this.authService.refresh(rawRefreshToken);
    setAuthCookies(reply, tokens, this.cookieOptions());
    return { user: toPublicUser(user) };
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the current session.' })
  async signOut(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.authService.signOut(request.cookies[REFRESH_TOKEN_COOKIE]);
    clearAuthCookies(reply, this.cookieOptions());
  }

  @Public()
  @Post('request-password-reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Email a password-reset link, if the address is registered.' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    const webOrigin = this.configService.get('WEB_ORIGIN', { infer: true });
    await this.authService.requestPasswordReset(dto.email, `${webOrigin}/reset-password`);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Redeem a reset token and set a new password.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Preview a pending invitation before accepting it.' })
  async invitationPreview(@Param('token') token: string) {
    return this.authService.getInvitationPreview(token);
  }

  @Public()
  @Post('accept-invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an account from an invitation and start a session.' })
  async acceptInvite(
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { user, tokens } = await this.authService.acceptInvitation(
      dto.token,
      dto.name,
      dto.password,
    );
    setAuthCookies(reply, tokens, this.cookieOptions());
    return { user: toPublicUser(user) };
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user, from the current session.' })
  async me(@CurrentUser() claims: JwtPayload) {
    const user = await this.usersService.findById(claims.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session expired or invalid.');
    }
    return { user: toPublicUser(user) };
  }
}
