import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, prisma, type Action, type ActionStatus } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface CreateActionInput {
  initiativeId?: string;
  reviewId?: string;
  title: string;
  milestoneId?: string;
  assigneeUserId?: string;
  assigneeExternalName?: string;
  dueDate?: string;
}

export interface UpdateActionInput {
  version: number;
  status?: ActionStatus;
  blockerReason?: string;
  completionNote?: string;
  title?: string;
  milestoneId?: string;
  assigneeUserId?: string;
  assigneeExternalName?: string;
  dueDate?: string;
}

/**
 * Same documented deviation as Initiative/Partnership: Table 13 draws no
 * reverse arrow, but an Action stuck at Blocked forever (no way back to In
 * Progress) would defeat the point of unblocking it.
 */
const VALID_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  OPEN: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'DONE', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

@Injectable()
export class ActionsService {
  private async assertParentsExist(
    tenantId: string,
    initiativeId?: string,
    reviewId?: string,
  ): Promise<void> {
    if (initiativeId) {
      const initiative = await prisma.initiative.findFirst({
        where: { id: initiativeId, tenantId },
        select: { id: true },
      });
      if (!initiative) {
        throw new NotFoundException('Initiative not found.');
      }
    }
    if (reviewId) {
      const review = await prisma.review.findFirst({
        where: { id: reviewId, tenantId },
        select: { id: true },
      });
      if (!review) {
        throw new NotFoundException('Review not found.');
      }
    }
  }

  private async assertAssignable(
    tenantId: string,
    initiativeId: string | undefined,
    milestoneId?: string,
    assigneeUserId?: string,
  ): Promise<void> {
    if (milestoneId) {
      if (!initiativeId) {
        throw new UnprocessableEntityException(
          'A milestone can only be linked through its own initiative.',
        );
      }
      const milestone = await prisma.milestone.findFirst({
        where: { id: milestoneId, initiativeId, tenantId },
        select: { id: true },
      });
      if (!milestone) {
        throw new UnprocessableEntityException(
          'This milestone does not belong to this initiative.',
        );
      }
    }
    if (assigneeUserId) {
      const membership = await prisma.membership.findFirst({
        where: { tenantId, userId: assigneeUserId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!membership) {
        throw new UnprocessableEntityException(
          'The assignee must be an active member of this tenant.',
        );
      }
    }
  }

  async create(tenantId: string, input: CreateActionInput, actingUserId: string): Promise<Action> {
    if (!input.initiativeId && !input.reviewId) {
      throw new UnprocessableEntityException(
        'An action needs to belong to an initiative or a review.',
      );
    }
    await this.assertParentsExist(tenantId, input.initiativeId, input.reviewId);
    if (!input.assigneeUserId && !input.assigneeExternalName?.trim()) {
      throw new UnprocessableEntityException(
        'An action needs an assignee — a tenant member or a named counterpart.',
      );
    }
    await this.assertAssignable(
      tenantId,
      input.initiativeId,
      input.milestoneId,
      input.assigneeUserId,
    );

    const action = await prisma.action.create({
      data: {
        tenantId,
        initiativeId: input.initiativeId,
        reviewId: input.reviewId,
        milestoneId: input.milestoneId,
        title: input.title,
        assigneeUserId: input.assigneeUserId,
        assigneeExternalName: input.assigneeExternalName,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'action_created',
      objectType: 'Action',
      objectId: action.id,
      after: action,
    });
    return action;
  }

  async update(
    tenantId: string,
    actionId: string,
    { version, status, blockerReason, ...data }: UpdateActionInput,
    actingUserId: string,
  ): Promise<Action> {
    const current = await prisma.action.findFirst({ where: { id: actionId, tenantId } });
    if (!current) {
      throw new NotFoundException('Action not found.');
    }

    if (status && status !== current.status) {
      if (!VALID_TRANSITIONS[current.status].includes(status)) {
        throw new UnprocessableEntityException(
          `Cannot move an action from ${current.status} to ${status}.`,
        );
      }
      if (status === 'BLOCKED' && !blockerReason?.trim()) {
        throw new UnprocessableEntityException('Moving an action to Blocked requires a reason.');
      }
    }

    const effectiveAssigneeUserId =
      data.assigneeUserId !== undefined ? data.assigneeUserId : current.assigneeUserId;
    const effectiveExternalName =
      data.assigneeExternalName !== undefined
        ? data.assigneeExternalName
        : current.assigneeExternalName;
    if (!effectiveAssigneeUserId && !effectiveExternalName?.trim()) {
      throw new UnprocessableEntityException(
        'An action needs an assignee — a tenant member or a named counterpart.',
      );
    }
    if (data.milestoneId !== undefined || data.assigneeUserId !== undefined) {
      await this.assertAssignable(
        tenantId,
        current.initiativeId ?? undefined,
        data.milestoneId,
        data.assigneeUserId,
      );
    }

    try {
      const updated = await prisma.action.update({
        where: { id: actionId, tenantId, version },
        data: {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          status,
          blockerReason:
            status === 'BLOCKED' ? blockerReason : status ? null : (blockerReason ?? undefined),
          completedAt: status === 'DONE' ? new Date() : undefined,
          updatedById: actingUserId,
          version: { increment: 1 },
        },
      });
      if (status && status !== current.status) {
        await recordAuditEvent(tenantId, {
          actorId: actingUserId,
          action: 'action_status_changed',
          objectType: 'Action',
          objectId: updated.id,
          before: current,
          after: updated,
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This action was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }
}
