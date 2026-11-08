import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  prisma,
  type Partnership,
  type PartnershipHealth,
  type PartnershipStage,
} from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';
import { toCsv } from '../../../common/csv';

export interface CreatePartnershipInput {
  ownerId?: string;
  sponsorId?: string;
  motion?: string;
  objective?: string;
  cadence?: string;
}

export interface UpdatePartnershipInput {
  version: number;
  stage?: PartnershipStage;
  transitionReason?: string;
  ownerId?: string;
  sponsorId?: string;
  motion?: string;
  objective?: string;
  cadence?: string;
  health?: PartnershipHealth;
  nextReviewAt?: string;
}

/**
 * PRD Table 13's "valid path" is drawn as one arrow-chain with no reverse
 * arrows for any object, but a governed relationship that can never recover
 * from At Risk back to Active defeats the point of tracking health — see the
 * schema.prisma comment for the full reasoning. Terminated is reachable from
 * any pre-Archived stage (ending a relationship shouldn't require walking
 * every intermediate stage first); Archived only follows Terminated.
 */
const VALID_TRANSITIONS: Record<PartnershipStage, PartnershipStage[]> = {
  PROSPECT: ['QUALIFIED', 'TERMINATED'],
  QUALIFIED: ['PLANNING', 'TERMINATED'],
  PLANNING: ['ACTIVE', 'TERMINATED'],
  ACTIVE: ['AT_RISK', 'PAUSED', 'TERMINATED'],
  AT_RISK: ['ACTIVE', 'PAUSED', 'TERMINATED'],
  PAUSED: ['ACTIVE', 'AT_RISK', 'TERMINATED'],
  TERMINATED: ['ARCHIVED'],
  ARCHIVED: [],
};

// PORT-04: "Transition reasons ... enforced" — required for the
// exception/exit transitions, not for ordinary forward progress.
const STAGES_REQUIRING_REASON: PartnershipStage[] = ['AT_RISK', 'PAUSED', 'TERMINATED'];

// Table 67: owner_id "Yes at Qualified" — every stage from Qualified onward
// except the exit states, which are always reachable regardless of how
// complete the relationship's fields are (see schema.prisma comment).
const STAGES_REQUIRING_OWNER: PartnershipStage[] = [
  'QUALIFIED',
  'PLANNING',
  'ACTIVE',
  'AT_RISK',
  'PAUSED',
];

// Table 13's invariant ("cannot activate without owner, motion, objective
// and cadence") plus Table 67's "health"/"next_review_at" "Yes at Active" —
// applied to Active and its At Risk/Paused siblings, since those are Active
// with a different health flag, not a fresh unconfigured state.
const STAGES_REQUIRING_ACTIVATION_READINESS: PartnershipStage[] = ['ACTIVE', 'AT_RISK', 'PAUSED'];

type PartnershipRecord = Pick<
  Partnership,
  'ownerId' | 'motion' | 'objective' | 'cadence' | 'health' | 'nextReviewAt'
>;

@Injectable()
export class PartnershipsService {
  private readonly logger = new Logger(PartnershipsService.name);

  /** PORT-01's list, for the portfolio-wide view — full server-side filter/search is deferred (see docs/DECISIONS.md); this returns every relationship in the tenant for the client to join against its partner list. */
  listForTenant(tenantId: string): Promise<Partnership[]> {
    return prisma.partnership.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  }

  /**
   * RPT-02 / PRD §2.2: "Exports apply the same row and field policies as
   * the initiating user" — built on the identical `listForTenant` query the
   * JSON list route serves, so the exported rows can never drift from what
   * this caller is already authorized to see in the UI (T-022's own
   * acceptance gate). Logs `export_completed` as both the PRD-required
   * analytics event and a real audit event.
   */
  async exportCsv(
    tenantId: string,
    actingUserId: string,
  ): Promise<{ csv: string; recordCount: number }> {
    const startedAt = Date.now();
    const partnerships = await this.listForTenant(tenantId);

    const partnerIds = [...new Set(partnerships.map((p) => p.partnerId))];
    const userIds = [
      ...new Set(
        partnerships.flatMap((p) => [p.ownerId, p.sponsorId].filter((id): id is string => !!id)),
      ),
    ];
    const [partners, users] = await Promise.all([
      prisma.partner.findMany({ where: { id: { in: partnerIds } } }),
      prisma.user.findMany({ where: { id: { in: userIds } } }),
    ]);
    const partnerById = new Map(partners.map((p) => [p.id, p]));
    const userById = new Map(users.map((u) => [u.id, u]));

    const headers = [
      'Partner',
      'Segment',
      'Stage',
      'Health',
      'Owner',
      'Sponsor',
      'Motion',
      'Objective',
      'Cadence',
      'Next Review',
      'Created At',
    ];
    const rows = partnerships.map((p) => [
      partnerById.get(p.partnerId)?.displayName ?? '',
      partnerById.get(p.partnerId)?.segment ?? '',
      p.stage,
      p.health ?? '',
      p.ownerId ? (userById.get(p.ownerId)?.name ?? '') : '',
      p.sponsorId ? (userById.get(p.sponsorId)?.name ?? '') : '',
      p.motion ?? '',
      p.objective ?? '',
      p.cadence ?? '',
      p.nextReviewAt ? p.nextReviewAt.toISOString() : '',
      p.createdAt.toISOString(),
    ]);

    const exportId = randomUUID();
    this.logger.log(
      `export_completed export_id=${exportId} type=partnerships record_count=${partnerships.length} filter_hash=none duration_ms=${Date.now() - startedAt}`,
    );
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'export_completed',
      objectType: 'Partnership',
      objectId: exportId,
      after: { type: 'partnerships', recordCount: partnerships.length },
    });

    return { csv: toCsv(headers, rows), recordCount: partnerships.length };
  }

  async get(tenantId: string, partnerId: string): Promise<Partnership> {
    const partnership = await prisma.partnership.findFirst({ where: { partnerId, tenantId } });
    if (!partnership) {
      throw new NotFoundException('This partner has no partnership yet.');
    }
    return partnership;
  }

  async create(
    tenantId: string,
    partnerId: string,
    input: CreatePartnershipInput,
    actingUserId: string,
  ): Promise<Partnership> {
    const partner = await prisma.partner.findFirst({ where: { id: partnerId, tenantId } });
    if (!partner) {
      throw new NotFoundException('Partner not found.');
    }

    try {
      const partnership = await prisma.partnership.create({
        data: {
          tenantId,
          partnerId,
          ownerId: input.ownerId,
          sponsorId: input.sponsorId,
          motion: input.motion,
          objective: input.objective,
          cadence: input.cadence,
          createdById: actingUserId,
          updatedById: actingUserId,
        },
      });

      // PRD-required analytics event (§5.1's event schema): relationship_id,
      // source, owner, motion. No import pipeline exists yet (Roadmap Phase 2
      // item 6), so `source` is always "manual" for now.
      this.logger.log(
        `partnership_created relationship_id=${partnership.id} source=manual owner=${partnership.ownerId ?? '(none)'} motion=${partnership.motion ?? '(none)'}`,
      );
      await recordAuditEvent(tenantId, {
        actorId: actingUserId,
        action: 'partnership_created',
        objectType: 'Partnership',
        objectId: partnership.id,
        after: partnership,
      });

      return partnership;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This partner already has a partnership.');
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    partnerId: string,
    { version, stage, transitionReason, ...data }: UpdatePartnershipInput,
    actingUserId: string,
  ): Promise<Partnership> {
    const current = await this.get(tenantId, partnerId);

    const targetStage = stage ?? current.stage;
    if (stage && stage !== current.stage) {
      if (!VALID_TRANSITIONS[current.stage].includes(stage)) {
        throw new UnprocessableEntityException(
          `Cannot move a partnership from ${current.stage} to ${stage}.`,
        );
      }
      if (STAGES_REQUIRING_REASON.includes(stage) && !transitionReason?.trim()) {
        throw new UnprocessableEntityException(
          `Moving a partnership to ${stage} requires a transition reason.`,
        );
      }
    }

    const effective: PartnershipRecord = {
      ownerId: data.ownerId !== undefined ? data.ownerId : current.ownerId,
      motion: data.motion !== undefined ? data.motion : current.motion,
      objective: data.objective !== undefined ? data.objective : current.objective,
      cadence: data.cadence !== undefined ? data.cadence : current.cadence,
      health: (data.health !== undefined ? data.health : current.health) as
        Partnership['health'] | null,
      nextReviewAt:
        data.nextReviewAt !== undefined ? new Date(data.nextReviewAt) : current.nextReviewAt,
    };

    if (STAGES_REQUIRING_OWNER.includes(targetStage) && !effective.ownerId) {
      throw new UnprocessableEntityException(`A partnership at ${targetStage} must have an owner.`);
    }
    if (STAGES_REQUIRING_ACTIVATION_READINESS.includes(targetStage)) {
      const missing: string[] = (['motion', 'objective', 'cadence'] as const).filter(
        (f) => !effective[f],
      );
      if (!effective.ownerId) missing.push('ownerId');
      if (!effective.health) missing.push('health');
      if (!effective.nextReviewAt) missing.push('nextReviewAt');
      if (missing.length > 0) {
        throw new UnprocessableEntityException(
          `Cannot activate a partnership without: ${missing.join(', ')}.`,
        );
      }
    }

    try {
      const partnership = await prisma.partnership.update({
        where: { partnerId, tenantId, version },
        data: {
          ...data,
          nextReviewAt: data.nextReviewAt !== undefined ? new Date(data.nextReviewAt) : undefined,
          stage: targetStage,
          lastTransitionReason:
            stage && stage !== current.stage ? transitionReason : current.lastTransitionReason,
          updatedById: actingUserId,
          version: { increment: 1 },
        },
      });

      if (stage === 'ACTIVE' && current.stage !== 'ACTIVE') {
        // PRD-required analytics event: relationship_id, readiness_fields, activation_time.
        this.logger.log(
          `partnership_activated relationship_id=${partnership.id} readiness_fields=owner,motion,objective,cadence,health,nextReviewAt activation_time=${partnership.updatedAt.toISOString()}`,
        );
      }
      await recordAuditEvent(tenantId, {
        actorId: actingUserId,
        action:
          stage && stage !== current.stage ? 'partnership_stage_changed' : 'partnership_updated',
        objectType: 'Partnership',
        objectId: partnership.id,
        before: current,
        after: partnership,
      });

      return partnership;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This partnership was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }
}
