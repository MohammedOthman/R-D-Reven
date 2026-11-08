import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, type Membership, type MembershipRole, type MembershipStatus } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface MemberWithUser extends Membership {
  user: { id: string; name: string; email: string };
}

@Injectable()
export class MembersService {
  /** Excludes REMOVED — a removed membership isn't "a member" any more, just a historical record (ADM-02: authorship must survive, but they no longer appear as active/suspended staff). */
  list(tenantId: string): Promise<MemberWithUser[]> {
    return prisma.membership.findMany({
      where: { tenantId, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Only ACTIVE — a suspended member shouldn't be assignable as a new partnership owner/sponsor. Minimal shape: no role/status, this isn't for member management. */
  async directory(tenantId: string): Promise<{ id: string; name: string; email: string }[]> {
    const memberships = await prisma.membership.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => m.user);
  }

  async update(
    tenantId: string,
    membershipId: string,
    data: { role?: MembershipRole; status?: MembershipStatus },
    actingUserId: string,
  ): Promise<Membership> {
    const membership = await prisma.membership.findFirst({ where: { id: membershipId, tenantId } });
    if (!membership) {
      throw new NotFoundException('Member not found.');
    }

    const losesOwnership =
      membership.role === 'OWNER' &&
      membership.status === 'ACTIVE' &&
      ((data.role && data.role !== 'OWNER') || (data.status && data.status !== 'ACTIVE'));

    if (losesOwnership && (await this.isLastActiveOwner(tenantId, membershipId))) {
      throw new ConflictException('An organization must always have at least one active owner.');
    }

    const updated = await prisma.membership.update({ where: { id: membershipId }, data });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'membership_updated',
      objectType: 'Membership',
      objectId: updated.id,
      before: membership,
      after: updated,
    });
    return updated;
  }

  private async isLastActiveOwner(tenantId: string, membershipId: string): Promise<boolean> {
    const otherActiveOwners = await prisma.membership.count({
      where: { tenantId, role: 'OWNER', status: 'ACTIVE', id: { not: membershipId } },
    });
    return otherActiveOwners === 0;
  }
}
