import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { prisma, type User } from '@revn/db';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mail/mailer.service';
import { generateOpaqueToken, hashToken } from '../../../common/opaque-token';
import { recordAuditEvent } from '../../audit-operations/audit.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  PASSWORD_RESET_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants';
import type { JwtPayload } from './jwt-payload.type';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  async signUp(
    email: string,
    password: string,
    name: string,
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.usersService.create({ email, passwordHash, name });
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async signIn(email: string, password: string): Promise<{ user: User; tokens: IssuedTokens }> {
    const user = await this.usersService.findByEmail(email);
    // Same error for "no such user" and "wrong password" — don't disclose
    // account existence (PRD §7.1: denial responses stay generic).
    const invalidCredentials = () => new UnauthorizedException('Invalid email or password.');

    if (!user) {
      throw invalidCredentials();
    }
    if (user.status !== 'ACTIVE') {
      throw invalidCredentials();
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw invalidCredentials();
    }

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  /** Rotates the refresh token — the presented one is revoked whether or not the rotation succeeds. */
  async refresh(rawRefreshToken: string): Promise<{ user: User; tokens: IssuedTokens }> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or invalid.');
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.usersService.findById(stored.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Session expired or invalid.');
    }

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async signOut(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Always succeeds from the caller's point of view — doesn't reveal whether the email is registered. */
  async requestPasswordReset(email: string, resetUrlBase: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const rawToken = generateOpaqueToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000),
      },
    });

    this.mailerService.sendPasswordResetEmail(user.email, `${resetUrlBase}?token=${rawToken}`);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('This reset link is invalid or has expired.');
    }

    const passwordHash = await argon2.hash(newPassword);

    await prisma.$transaction([
      prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      // Resetting a password revokes every existing session — a stolen
      // session shouldn't survive the owner regaining control of the account.
      prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /** For the accept-invite page to show "you've been invited to X as Y" before asking for a password. */
  async getInvitationPreview(
    rawToken: string,
  ): Promise<{ email: string; tenantName: string; role: string }> {
    const tokenHash = hashToken(rawToken);
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: { tenant: { select: { name: true } } },
    });

    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw new NotFoundException('This invitation is invalid or has expired.');
    }

    return { email: invitation.email, tenantName: invitation.tenant.name, role: invitation.role };
  }

  /**
   * ADM-02's invite path, for the one case this phase supports: the invited
   * email has no existing account. Creating the user, the membership (with
   * the role the invitation specified) and marking the invitation accepted
   * happen in one transaction — there's no valid state where one succeeds
   * without the others.
   */
  async acceptInvitation(
    rawToken: string,
    name: string,
    password: string,
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const tokenHash = hashToken(rawToken);
    const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });

    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
      throw new UnauthorizedException('This invitation is invalid or has expired.');
    }

    const existingUser = await this.usersService.findByEmail(invitation.email);
    if (existingUser) {
      throw new ConflictException('An account with this email already exists. Sign in instead.');
    }

    const passwordHash = await argon2.hash(password);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { email: invitation.email, passwordHash, name },
      });
      await tx.membership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: createdUser.id,
          role: invitation.role,
          status: 'ACTIVE',
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      return createdUser;
    });

    await recordAuditEvent(invitation.tenantId, {
      actorId: user.id,
      action: 'invitation_accepted',
      objectType: 'Invitation',
      objectId: invitation.id,
      after: { userId: user.id, role: invitation.role },
    });

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  /** Opens a session for an already-authenticated user (pilot mode's shared account). */
  startSession(user: User): Promise<IssuedTokens> {
    return this.issueTokens(user);
  }

  private async issueTokens(user: User): Promise<IssuedTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    const rawRefreshToken = generateOpaqueToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
