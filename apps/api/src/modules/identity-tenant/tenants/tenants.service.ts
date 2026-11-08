import { ConflictException, Injectable } from '@nestjs/common';
import { prisma, type Tenant, type Membership, type MembershipRole } from '@revn/db';
import { slugify } from './slugify';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface TenantWithRole {
  tenant: Tenant;
  role: MembershipRole;
}

@Injectable()
export class TenantsService {
  /** A user's one active membership — the only shape this phase's UI (no tenant switcher yet) needs. */
  async findForUser(userId: string): Promise<TenantWithRole | null> {
    const membership = await prisma.membership.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) return null;
    return { tenant: membership.tenant, role: membership.role };
  }

  async findById(id: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({ where: { id } });
  }

  async membershipFor(tenantId: string, userId: string): Promise<Membership | null> {
    return prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
  }

  /** The signing-up-first-user-creates-the-org path — no invitations exist yet, so a user with an active membership can't create a second tenant this way. */
  async create(name: string, ownerUserId: string): Promise<TenantWithRole> {
    const existing = await this.findForUser(ownerUserId);
    if (existing) {
      throw new ConflictException('You already belong to an organization.');
    }

    const slug = await this.uniqueSlug(name);
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        memberships: {
          create: { userId: ownerUserId, role: 'OWNER', status: 'ACTIVE' },
        },
      },
    });

    await recordAuditEvent(tenant.id, {
      actorId: ownerUserId,
      action: 'tenant_created',
      objectType: 'Tenant',
      objectId: tenant.id,
      after: tenant,
    });

    return { tenant, role: 'OWNER' };
  }

  /** Authorization (owner/admin only) is `RoleGuard`'s job, via `@RequireRole` on the controller route — this only does the update. */
  async update(
    tenantId: string,
    data: { name?: string; timezone?: string; locale?: string },
  ): Promise<Tenant> {
    return prisma.tenant.update({ where: { id: tenantId }, data });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let suffix = 1;
    while (true) {
      const taken = await prisma.tenant.findUnique({ where: { slug: candidate } });
      if (!taken) return candidate;
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
  }
}
