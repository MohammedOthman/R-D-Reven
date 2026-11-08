import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, prisma, type Contribution } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface CreateContributionInput {
  partnershipId?: string;
  initiativeId?: string;
  actionId?: string;
  outcomeId?: string;
  type: string;
  actorId?: string;
  observedAt: string;
  narrative: string;
  classification?: 'INTERNAL' | 'SHAREABLE';
}

export interface UpdateContributionInput {
  version: number;
  type?: string;
  observedAt?: string;
  narrative?: string;
  classification?: 'INTERNAL' | 'SHAREABLE';
}

@Injectable()
export class ContributionsService {
  private async assertLinksExist(
    tenantId: string,
    { partnershipId, initiativeId, actionId, outcomeId }: CreateContributionInput,
  ): Promise<void> {
    if (partnershipId) {
      const partnership = await prisma.partnership.findFirst({
        where: { id: partnershipId, tenantId },
        select: { id: true },
      });
      if (!partnership) throw new NotFoundException('Partnership not found.');
    }
    if (initiativeId) {
      const initiative = await prisma.initiative.findFirst({
        where: { id: initiativeId, tenantId },
        select: { id: true },
      });
      if (!initiative) throw new NotFoundException('Initiative not found.');
    }
    if (actionId) {
      const action = await prisma.action.findFirst({
        where: { id: actionId, tenantId },
        select: { id: true },
      });
      if (!action) throw new NotFoundException('Action not found.');
    }
    if (outcomeId) {
      const outcome = await prisma.outcome.findFirst({
        where: { id: outcomeId, tenantId },
        select: { id: true },
      });
      if (!outcome) throw new NotFoundException('Outcome not found.');
    }
  }

  list(
    tenantId: string,
    filters: {
      partnershipId?: string;
      initiativeId?: string;
      actionId?: string;
      outcomeId?: string;
    },
  ): Promise<Contribution[]> {
    return prisma.contribution.findMany({
      where: { tenantId, ...filters },
      orderBy: { observedAt: 'desc' },
      include: { evidence: true },
    });
  }

  async get(tenantId: string, contributionId: string): Promise<Contribution> {
    const contribution = await prisma.contribution.findFirst({
      where: { id: contributionId, tenantId },
      include: { evidence: true },
    });
    if (!contribution) {
      throw new NotFoundException('Contribution not found.');
    }
    return contribution;
  }

  async create(
    tenantId: string,
    input: CreateContributionInput,
    actingUserId: string,
  ): Promise<Contribution> {
    // EVD-01: "linked to partner, initiative, action or outcome" — at least
    // one required, mirroring Action's initiativeId/reviewId pattern.
    if (!input.partnershipId && !input.initiativeId && !input.actionId && !input.outcomeId) {
      throw new UnprocessableEntityException(
        'A contribution needs to link to a partnership, initiative, action or outcome.',
      );
    }
    await this.assertLinksExist(tenantId, input);

    const contribution = await prisma.contribution.create({
      data: {
        tenantId,
        partnershipId: input.partnershipId,
        initiativeId: input.initiativeId,
        actionId: input.actionId,
        outcomeId: input.outcomeId,
        type: input.type,
        actorId: input.actorId ?? actingUserId,
        observedAt: new Date(input.observedAt),
        narrative: input.narrative,
        classification: input.classification ?? 'INTERNAL',
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'contribution_created',
      objectType: 'Contribution',
      objectId: contribution.id,
      after: contribution,
    });
    return contribution;
  }

  async update(
    tenantId: string,
    contributionId: string,
    { version, observedAt, ...data }: UpdateContributionInput,
    actingUserId: string,
  ): Promise<Contribution> {
    await this.get(tenantId, contributionId);

    try {
      return await prisma.contribution.update({
        where: { id: contributionId, tenantId, version },
        data: {
          ...data,
          observedAt: observedAt ? new Date(observedAt) : undefined,
          updatedById: actingUserId,
          version: { increment: 1 },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This contribution was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }
}
