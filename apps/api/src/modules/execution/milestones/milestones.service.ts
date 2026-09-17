import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma, type Milestone } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface CreateMilestoneInput {
  title: string;
  targetDate: string;
  ownerId?: string;
  completionRule?: string;
  order?: number;
}

export interface UpdateMilestoneInput {
  version: number;
  title?: string;
  targetDate?: string;
  ownerId?: string;
  completionRule?: string;
  order?: number;
  completed?: boolean;
}

@Injectable()
export class MilestonesService {
  private async assertInitiativeExists(tenantId: string, initiativeId: string): Promise<void> {
    const initiative = await prisma.initiative.findFirst({
      where: { id: initiativeId, tenantId },
      select: { id: true },
    });
    if (!initiative) {
      throw new NotFoundException('Initiative not found.');
    }
  }

  async create(
    tenantId: string,
    initiativeId: string,
    input: CreateMilestoneInput,
    actingUserId: string,
  ): Promise<Milestone> {
    await this.assertInitiativeExists(tenantId, initiativeId);

    let order = input.order;
    if (order === undefined) {
      const last = await prisma.milestone.findFirst({
        where: { initiativeId, tenantId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      order = (last?.order ?? -1) + 1;
    }

    const milestone = await prisma.milestone.create({
      data: {
        tenantId,
        initiativeId,
        title: input.title,
        targetDate: new Date(input.targetDate),
        ownerId: input.ownerId,
        completionRule: input.completionRule,
        order,
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'milestone_created',
      objectType: 'Milestone',
      objectId: milestone.id,
      after: milestone,
    });
    return milestone;
  }

  async update(
    tenantId: string,
    initiativeId: string,
    milestoneId: string,
    { version, completed, ...data }: UpdateMilestoneInput,
    actingUserId: string,
  ): Promise<Milestone> {
    const existing = await prisma.milestone.findFirst({
      where: { id: milestoneId, initiativeId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Milestone not found.');
    }

    try {
      const updated = await prisma.milestone.update({
        where: { id: milestoneId, initiativeId, tenantId, version },
        data: {
          ...data,
          targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
          completedAt: completed === undefined ? undefined : completed ? new Date() : null,
          updatedById: actingUserId,
          version: { increment: 1 },
        },
      });
      if (completed !== undefined && completed !== !!existing.completedAt) {
        await recordAuditEvent(tenantId, {
          actorId: actingUserId,
          action: 'milestone_completion_changed',
          objectType: 'Milestone',
          objectId: updated.id,
          before: existing,
          after: updated,
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This milestone was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }
}
