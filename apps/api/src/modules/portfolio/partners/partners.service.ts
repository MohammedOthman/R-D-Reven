import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma, type Partner } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface CreatePartnerInput {
  legalName: string;
  displayName?: string;
  segment?: string;
  domains?: string[];
}

export interface UpdatePartnerInput {
  version: number;
  legalName?: string;
  displayName?: string;
  segment?: string;
  domains?: string[];
  status?: 'ACTIVE' | 'ARCHIVED';
}

@Injectable()
export class PartnersService {
  list(tenantId: string): Promise<Partner[]> {
    return prisma.partner.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  }

  async get(tenantId: string, partnerId: string): Promise<Partner> {
    const partner = await prisma.partner.findFirst({ where: { id: partnerId, tenantId } });
    if (!partner) {
      throw new NotFoundException('Partner not found.');
    }
    return partner;
  }

  async create(
    tenantId: string,
    input: CreatePartnerInput,
    actingUserId: string,
  ): Promise<Partner> {
    try {
      const partner = await prisma.partner.create({
        data: {
          tenantId,
          legalName: input.legalName,
          displayName: input.displayName || input.legalName,
          segment: input.segment,
          domains: input.domains ?? [],
          createdById: actingUserId,
          updatedById: actingUserId,
        },
      });
      await recordAuditEvent(tenantId, {
        actorId: actingUserId,
        action: 'partner_created',
        objectType: 'Partner',
        objectId: partner.id,
        after: partner,
      });
      return partner;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A partner with this legal name already exists.');
      }
      throw error;
    }
  }

  /**
   * PRD §4.1 optimistic concurrency: the version check and the increment
   * happen in the same `WHERE`, atomically — not a separate read-then-write,
   * which would leave a race window between the two. `get()` runs first
   * specifically so a nonexistent `partnerId` reports 404 — without it, a
   * missing row and a version mismatch would be indistinguishable (both are
   * "no row matched", Prisma's P2025), and a bad id would misleadingly
   * report 409 "someone else changed this" instead of "not found."
   */
  async update(
    tenantId: string,
    partnerId: string,
    { version, ...data }: UpdatePartnerInput,
    actingUserId: string,
  ): Promise<Partner> {
    const current = await this.get(tenantId, partnerId);

    try {
      const updated = await prisma.partner.update({
        where: { id: partnerId, tenantId, version },
        data: { ...data, updatedById: actingUserId, version: { increment: 1 } },
      });
      await recordAuditEvent(tenantId, {
        actorId: actingUserId,
        action: 'partner_updated',
        objectType: 'Partner',
        objectId: updated.id,
        before: current,
        after: updated,
      });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This partner was changed by someone else. Refresh and try again.',
        );
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A partner with this legal name already exists.');
      }
      throw error;
    }
  }
}
