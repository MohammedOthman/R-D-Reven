import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, type Invitation, type MembershipRole } from '@revn/db';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mail/mailer.service';
import { generateOpaqueToken, hashToken } from '../../../common/opaque-token';
import { INVITATION_TTL_SECONDS } from './invitations.constants';
import { recordAuditEvent } from '../../audit-operations/audit.service';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailerService: MailerService,
  ) {}

  list(tenantId: string): Promise<Invitation[]> {
    return prisma.invitation.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    tenantId: string,
    email: string,
    role: MembershipRole,
    invitedById: string,
    acceptUrlBase: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException(
        'This person already has an account. Joining an existing account is not supported yet.',
      );
    }

    const existingPending = await prisma.invitation.findFirst({
      where: { tenantId, email: normalizedEmail, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException('This email already has a pending invitation.');
    }

    const rawToken = generateOpaqueToken();
    const invitation = await prisma.invitation.create({
      data: {
        tenantId,
        email: normalizedEmail,
        role,
        tokenHash: hashToken(rawToken),
        invitedById,
        expiresAt: new Date(Date.now() + INVITATION_TTL_SECONDS * 1000),
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: invitedById,
      action: 'invitation_created',
      objectType: 'Invitation',
      objectId: invitation.id,
      after: { ...invitation, tokenHash: undefined },
    });

    this.mailerService.sendInvitationEmail(normalizedEmail, `${acceptUrlBase}?token=${rawToken}`);
  }

  async revoke(tenantId: string, invitationId: string, actingUserId: string): Promise<void> {
    const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, tenantId } });
    if (!invitation || invitation.status !== 'PENDING') {
      throw new NotFoundException('Invitation not found.');
    }
    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'invitation_revoked',
      objectType: 'Invitation',
      objectId: updated.id,
      before: { ...invitation, tokenHash: undefined },
      after: { ...updated, tokenHash: undefined },
    });
  }
}
