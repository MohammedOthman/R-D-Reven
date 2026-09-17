import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, prisma, type Initiative, type InitiativeStage } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';
import { toCsv } from '../../../common/csv';

export interface CreateInitiativeInput {
  partnershipId: string;
  objective: string;
  successMeasure?: Record<string, unknown>;
  visibility?: string;
  ownerId?: string;
  startDate?: string;
  targetDate?: string;
}

export interface UpdateInitiativeInput {
  version: number;
  stage?: InitiativeStage;
  lastTransitionReason?: string;
  objective?: string;
  successMeasure?: Record<string, unknown>;
  visibility?: string;
  health?: string;
  ownerId?: string;
  startDate?: string;
  targetDate?: string;
  completionDisposition?: string;
  remainingActionsTreatment?: string;
  completionOverrideReason?: string;
}

/**
 * Table 13's arrow-chain draws no reverse move for Initiative either — see
 * the schema.prisma migration note. Active⇄Blocked is a recoverable pair;
 * Cancelled is reachable from any non-terminal stage (an initiative can be
 * abandoned at any point, not only right before completion); Completed is
 * reachable from Active or Blocked (T-007 is literally about completing
 * *while* Blocked).
 */
const VALID_TRANSITIONS: Record<InitiativeStage, InitiativeStage[]> = {
  DRAFT: ['PROPOSED', 'CANCELLED'],
  PROPOSED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['BLOCKED', 'COMPLETED', 'CANCELLED'],
  BLOCKED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class InitiativesService {
  private readonly logger = new Logger(InitiativesService.name);

  list(tenantId: string, partnershipId?: string): Promise<Initiative[]> {
    return prisma.initiative.findMany({
      where: { tenantId, ...(partnershipId ? { partnershipId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** RPT-02 / PRD §2.2 — built on the identical `list` query the JSON list route serves. See PartnershipsService.exportCsv for the full reasoning. */
  async exportCsv(
    tenantId: string,
    actingUserId: string,
    partnershipId?: string,
  ): Promise<{ csv: string; recordCount: number }> {
    const startedAt = Date.now();
    const initiatives = await this.list(tenantId, partnershipId);

    const partnershipIds = [...new Set(initiatives.map((i) => i.partnershipId))];
    const ownerIds = [
      ...new Set(initiatives.map((i) => i.ownerId).filter((id): id is string => !!id)),
    ];
    const [partnerships, owners] = await Promise.all([
      prisma.partnership.findMany({ where: { id: { in: partnershipIds } } }),
      prisma.user.findMany({ where: { id: { in: ownerIds } } }),
    ]);
    const partnerIds = [...new Set(partnerships.map((p) => p.partnerId))];
    const partners = await prisma.partner.findMany({ where: { id: { in: partnerIds } } });
    const partnerById = new Map(partners.map((p) => [p.id, p]));
    const partnershipById = new Map(partnerships.map((p) => [p.id, p]));
    const ownerById = new Map(owners.map((u) => [u.id, u]));

    const headers = [
      'Partner',
      'Objective',
      'Stage',
      'Health',
      'Owner',
      'Start Date',
      'Target Date',
      'Created At',
    ];
    const rows = initiatives.map((i) => {
      const partnership = partnershipById.get(i.partnershipId);
      const partner = partnership ? partnerById.get(partnership.partnerId) : undefined;
      return [
        partner?.displayName ?? '',
        i.objective,
        i.stage,
        i.health ?? '',
        i.ownerId ? (ownerById.get(i.ownerId)?.name ?? '') : '',
        i.startDate ? i.startDate.toISOString() : '',
        i.targetDate ? i.targetDate.toISOString() : '',
        i.createdAt.toISOString(),
      ];
    });

    const exportId = randomUUID();
    this.logger.log(
      `export_completed export_id=${exportId} type=initiatives record_count=${initiatives.length} filter_hash=${partnershipId ?? 'none'} duration_ms=${Date.now() - startedAt}`,
    );
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'export_completed',
      objectType: 'Initiative',
      objectId: exportId,
      after: {
        type: 'initiatives',
        recordCount: initiatives.length,
        partnershipId: partnershipId ?? null,
      },
    });

    return { csv: toCsv(headers, rows), recordCount: initiatives.length };
  }

  async get(tenantId: string, initiativeId: string) {
    const initiative = await prisma.initiative.findFirst({
      where: { id: initiativeId, tenantId },
      include: {
        milestones: { orderBy: { order: 'asc' } },
        actions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!initiative) {
      throw new NotFoundException('Initiative not found.');
    }
    return initiative;
  }

  private async getPlain(tenantId: string, initiativeId: string): Promise<Initiative> {
    const initiative = await prisma.initiative.findFirst({
      where: { id: initiativeId, tenantId },
    });
    if (!initiative) {
      throw new NotFoundException('Initiative not found.');
    }
    return initiative;
  }

  async create(
    tenantId: string,
    input: CreateInitiativeInput,
    actingUserId: string,
  ): Promise<Initiative> {
    const partnership = await prisma.partnership.findFirst({
      where: { id: input.partnershipId, tenantId },
    });
    if (!partnership) {
      throw new NotFoundException('Partnership not found.');
    }

    const initiative = await prisma.initiative.create({
      data: {
        tenantId,
        partnershipId: input.partnershipId,
        objective: input.objective,
        successMeasure: input.successMeasure as Prisma.InputJsonValue | undefined,
        visibility: input.visibility as Initiative['visibility'] | undefined,
        ownerId: input.ownerId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });

    // PRD-required analytics event (§5.2's event schema). `objective_type`
    // isn't a modeled field — no PRD text elsewhere names a taxonomy for it
    // (same ADM-05-not-built reason Partner.segment stays free text) — logged
    // as untyped rather than invented.
    this.logger.log(
      `initiative_created initiative_id=${initiative.id} relationship_id=${initiative.partnershipId} objective_type=(untyped) visibility=${initiative.visibility}`,
    );
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'initiative_created',
      objectType: 'Initiative',
      objectId: initiative.id,
      after: initiative,
    });

    return initiative;
  }

  async update(
    tenantId: string,
    initiativeId: string,
    {
      version,
      stage,
      lastTransitionReason,
      completionDisposition,
      remainingActionsTreatment,
      completionOverrideReason,
      ...data
    }: UpdateInitiativeInput,
    actingUserId: string,
  ): Promise<Initiative> {
    const current = await this.getPlain(tenantId, initiativeId);

    const targetStage = stage ?? current.stage;
    if (stage && stage !== current.stage) {
      if (!VALID_TRANSITIONS[current.stage].includes(stage)) {
        throw new UnprocessableEntityException(
          `Cannot move an initiative from ${current.stage} to ${stage}.`,
        );
      }
    }

    const effectiveSuccessMeasure =
      data.successMeasure !== undefined ? data.successMeasure : current.successMeasure;
    if (targetStage === 'ACTIVE' && !effectiveSuccessMeasure) {
      throw new UnprocessableEntityException(
        'An initiative must have a success measure to become Active.',
      );
    }

    let cancelRemainingActions = false;
    if (targetStage === 'COMPLETED' && current.stage !== 'COMPLETED') {
      if (!completionDisposition) {
        throw new UnprocessableEntityException(
          'Completing an initiative requires a completion disposition.',
        );
      }
      if (!remainingActionsTreatment) {
        throw new UnprocessableEntityException(
          'Completing an initiative requires a remaining-actions treatment.',
        );
      }
      const blockedActions = await prisma.action.count({
        where: { initiativeId, tenantId, status: 'BLOCKED' },
      });
      if (blockedActions > 0 && !completionOverrideReason?.trim()) {
        throw new UnprocessableEntityException(
          'This initiative cannot complete with unresolved blocking actions unless an authorized override is documented.',
        );
      }
      cancelRemainingActions = remainingActionsTreatment === 'CANCEL_REMAINING';
    }

    try {
      const initiative = await prisma.$transaction(async (tx) => {
        const updated = await tx.initiative.update({
          where: { id: initiativeId, tenantId, version },
          data: {
            ...data,
            successMeasure: data.successMeasure as Prisma.InputJsonValue | undefined,
            visibility: data.visibility as Initiative['visibility'] | undefined,
            health: data.health as Initiative['health'] | undefined,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
            stage: targetStage,
            lastTransitionReason:
              stage && stage !== current.stage
                ? lastTransitionReason
                : current.lastTransitionReason,
            completionDisposition:
              targetStage === 'COMPLETED'
                ? (completionDisposition as Initiative['completionDisposition'])
                : current.completionDisposition,
            remainingActionsTreatment:
              targetStage === 'COMPLETED'
                ? (remainingActionsTreatment as Initiative['remainingActionsTreatment'])
                : current.remainingActionsTreatment,
            completionOverrideReason:
              targetStage === 'COMPLETED'
                ? completionOverrideReason
                : current.completionOverrideReason,
            completedAt: targetStage === 'COMPLETED' ? new Date() : current.completedAt,
            updatedById: actingUserId,
            version: { increment: 1 },
          },
        });

        if (cancelRemainingActions) {
          await tx.action.updateMany({
            where: { initiativeId, tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
            data: { status: 'CANCELLED', updatedById: actingUserId },
          });
        }

        return updated;
      });

      if (stage && stage !== current.stage) {
        // PRD-required analytics event.
        this.logger.log(
          `initiative_status_changed initiative_id=${initiative.id} from=${current.stage} to=${initiative.stage} actor_role=(unknown) reason=${lastTransitionReason ?? '(none)'}`,
        );
      }
      await recordAuditEvent(tenantId, {
        actorId: actingUserId,
        action:
          stage && stage !== current.stage ? 'initiative_status_changed' : 'initiative_updated',
        objectType: 'Initiative',
        objectId: initiative.id,
        before: current,
        after: initiative,
      });

      return initiative;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This initiative was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }
}
