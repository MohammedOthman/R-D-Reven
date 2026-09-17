import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, prisma, type Review, type ReviewStage } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface CreateReviewInput {
  partnershipId: string;
  scheduledFor: string;
  period?: string;
  ownerId?: string;
  participantUserIds?: string[];
}

export interface UpdateReviewInput {
  version: number;
  stage?: ReviewStage;
  scheduledFor?: string;
  period?: string;
  ownerId?: string;
  participantUserIds?: string[];
  notes?: string;
  notesClassification?: string;
  nextReviewAt?: string;
}

/**
 * Unlike Partnership/Initiative/Action, nothing in the PRD suggests a
 * "stuck" state a review needs to recover from — the path stays exactly as
 * literal as Table 13 draws it. `Reopened` is a real state kept for the
 * enum but unreachable here — REV-06 ("reopen as revision") is P1, deferred.
 */
const VALID_TRANSITIONS: Record<ReviewStage, ReviewStage[]> = {
  SCHEDULED: ['IN_PREPARATION'],
  IN_PREPARATION: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  REOPENED: [],
};

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  list(tenantId: string, partnershipId?: string): Promise<Review[]> {
    return prisma.review.findMany({
      where: { tenantId, ...(partnershipId ? { partnershipId } : {}) },
      orderBy: { scheduledFor: 'desc' },
    });
  }

  async get(tenantId: string, reviewId: string) {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, tenantId },
      include: {
        decisions: { orderBy: { createdAt: 'asc' } },
        actions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!review) {
      throw new NotFoundException('Review not found.');
    }
    return review;
  }

  private async getPlain(tenantId: string, reviewId: string): Promise<Review> {
    const review = await prisma.review.findFirst({ where: { id: reviewId, tenantId } });
    if (!review) {
      throw new NotFoundException('Review not found.');
    }
    return review;
  }

  async create(tenantId: string, input: CreateReviewInput, actingUserId: string): Promise<Review> {
    const partnership = await prisma.partnership.findFirst({
      where: { id: input.partnershipId, tenantId },
    });
    if (!partnership) {
      throw new NotFoundException('Partnership not found.');
    }

    const review = await prisma.review.create({
      data: {
        tenantId,
        partnershipId: input.partnershipId,
        scheduledFor: new Date(input.scheduledFor),
        period: input.period,
        ownerId: input.ownerId,
        participantUserIds: input.participantUserIds ?? [],
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'review_created',
      objectType: 'Review',
      objectId: review.id,
      after: review,
    });
    return review;
  }

  async update(
    tenantId: string,
    reviewId: string,
    { version, stage, nextReviewAt, ...data }: UpdateReviewInput,
    actingUserId: string,
  ): Promise<Review> {
    const current = await this.getPlain(tenantId, reviewId);

    const targetStage = stage ?? current.stage;
    if (stage && stage !== current.stage) {
      if (!VALID_TRANSITIONS[current.stage].includes(stage)) {
        throw new UnprocessableEntityException(
          `Cannot move a review from ${current.stage} to ${stage}.`,
        );
      }
    }

    let snapshotFields:
      { snapshotId: string; snapshot: Prisma.InputJsonValue; snapshotAt: Date } | undefined;
    if (stage === 'IN_PREPARATION' && current.stage !== 'IN_PREPARATION') {
      snapshotFields = await this.captureSnapshot(tenantId, current.partnershipId);
    }

    if (stage === 'COMPLETED' && current.stage !== 'COMPLETED') {
      if (!nextReviewAt) {
        throw new UnprocessableEntityException(
          'Completing a review requires the next review date.',
        );
      }
      const [pendingDecisions, openActions] = await Promise.all([
        prisma.decision.count({ where: { reviewId, tenantId, status: 'PENDING_APPROVAL' } }),
        prisma.action.count({
          where: { reviewId, tenantId, status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] } },
        }),
      ]);
      if (pendingDecisions > 0 || openActions > 0) {
        throw new UnprocessableEntityException(
          `Cannot complete this review: ${pendingDecisions} decision(s) still pending approval and ${openActions} follow-up action(s) still open.`,
        );
      }
    }

    try {
      const review = await prisma.$transaction(async (tx) => {
        const updated = await tx.review.update({
          where: { id: reviewId, tenantId, version },
          data: {
            ...data,
            scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
            notesClassification: data.notesClassification as
              Review['notesClassification'] | undefined,
            stage: targetStage,
            ...(snapshotFields ?? {}),
            nextReviewAt: nextReviewAt ? new Date(nextReviewAt) : current.nextReviewAt,
            completedAt: targetStage === 'COMPLETED' ? new Date() : current.completedAt,
            updatedById: actingUserId,
            version: { increment: 1 },
          },
        });

        if (targetStage === 'COMPLETED' && nextReviewAt) {
          await tx.partnership.update({
            where: { id: current.partnershipId },
            data: { nextReviewAt: new Date(nextReviewAt) },
          });
        }

        return updated;
      });

      if (stage === 'COMPLETED' && current.stage !== 'COMPLETED') {
        const [decisions, followups] = await Promise.all([
          prisma.decision.count({ where: { reviewId, tenantId } }),
          prisma.action.count({ where: { reviewId, tenantId } }),
        ]);
        // PRD-required analytics event (§5.2's event schema).
        this.logger.log(
          `review_completed review_id=${review.id} relationship_id=${review.partnershipId} snapshot_id=${review.snapshotId ?? '(none)'} decisions=${decisions} followups=${followups}`,
        );
      }
      if (stage && stage !== current.stage) {
        await recordAuditEvent(tenantId, {
          actorId: actingUserId,
          action: 'review_stage_changed',
          objectType: 'Review',
          objectId: review.id,
          before: current,
          after: review,
        });
      }

      return review;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This review was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  /** REV-02: "prepare review snapshot of health, progress, changes, exceptions and decisions due." */
  private async captureSnapshot(
    tenantId: string,
    partnershipId: string,
  ): Promise<{ snapshotId: string; snapshot: Prisma.InputJsonValue; snapshotAt: Date }> {
    const [partnership, initiatives] = await Promise.all([
      prisma.partnership.findFirst({
        where: { id: partnershipId, tenantId },
        select: { stage: true, health: true, nextReviewAt: true },
      }),
      prisma.initiative.findMany({
        where: { partnershipId, tenantId },
        select: { id: true, objective: true, stage: true, health: true },
      }),
    ]);

    return {
      snapshotId: randomUUID(),
      snapshot: {
        partnership: partnership ?? null,
        initiatives,
      } as Prisma.InputJsonValue,
      snapshotAt: new Date(),
    };
  }
}
