import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, prisma, type Decision, type MembershipRole } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface CreateDecisionInput {
  type?: string;
  alternatives?: string;
  rationale: string;
  deciderId?: string;
  effectiveDate: string;
  impact?: string;
  initiativeId?: string;
  requiresApproval?: boolean;
}

export interface UpdateDecisionInput {
  version: number;
  status?: 'APPROVED' | 'REJECTED';
  approvalNote?: string;
  type?: string;
  alternatives?: string;
  rationale?: string;
  effectiveDate?: string;
  impact?: string;
}

// DEC-02 / §2.3: Executive's "Approve" cell is real capability here (unlike
// Partnership's own "Approve" cell, deferred because no approval workflow
// existed) — Owner is the tenant's ultimate authority throughout this app;
// Admin's cell is "Configure," a distinct capability this phase doesn't
// build a policy-configuration surface for, so Admin does not itself approve.
const APPROVE_ROLES: MembershipRole[] = ['OWNER', 'EXECUTIVE'];

@Injectable()
export class DecisionsService {
  private readonly logger = new Logger(DecisionsService.name);

  list(
    tenantId: string,
    filters: { partnershipId?: string; reviewId?: string },
  ): Promise<Decision[]> {
    return prisma.decision.findMany({
      where: { tenantId, ...filters },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, decisionId: string): Promise<Decision> {
    const decision = await prisma.decision.findFirst({ where: { id: decisionId, tenantId } });
    if (!decision) {
      throw new NotFoundException('Decision not found.');
    }
    return decision;
  }

  async createForReview(
    tenantId: string,
    reviewId: string,
    input: CreateDecisionInput,
    actingUserId: string,
  ): Promise<Decision> {
    const review = await prisma.review.findFirst({ where: { id: reviewId, tenantId } });
    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    const decision = await prisma.decision.create({
      data: {
        tenantId,
        partnershipId: review.partnershipId,
        reviewId,
        initiativeId: input.initiativeId,
        type: input.type,
        alternatives: input.alternatives,
        rationale: input.rationale,
        deciderId: input.deciderId ?? actingUserId,
        effectiveDate: new Date(input.effectiveDate),
        impact: input.impact,
        requiresApproval: input.requiresApproval ?? false,
        status: input.requiresApproval ? 'PENDING_APPROVAL' : 'RECORDED',
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });

    // PRD-required analytics event (§5.2's event schema) — fired once, at
    // the moment the decision is recorded.
    this.logger.log(
      `decision_recorded decision_id=${decision.id} type=${decision.type ?? '(untyped)'} relationship_id=${decision.partnershipId} approval_state=${decision.status}`,
    );
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'decision_recorded',
      objectType: 'Decision',
      objectId: decision.id,
      after: decision,
    });

    return decision;
  }

  async update(
    tenantId: string,
    decisionId: string,
    { version, status, approvalNote, ...data }: UpdateDecisionInput,
    actingUserId: string,
  ): Promise<Decision> {
    const current = await this.get(tenantId, decisionId);
    const membership = await prisma.membership.findFirst({
      where: { tenantId, userId: actingUserId, status: 'ACTIVE' },
    });

    // §2.3: Executive's own decisions capability is "Approve" only, not
    // "Yes" — the route itself accepts Executive (it must, to reach the
    // approval branch below), so plain field edits are blocked here instead.
    if (membership?.role === 'EXECUTIVE' && Object.keys(data).length > 0) {
      throw new ForbiddenException('Executives can approve or reject decisions, not edit them.');
    }

    if (status) {
      if (current.status !== 'PENDING_APPROVAL') {
        throw new UnprocessableEntityException('This decision is not pending approval.');
      }
      // INV-004: a decision cannot be approved by an unauthorized role or by
      // its own creator when separation of duties is enabled.
      if (current.createdById === actingUserId) {
        throw new ForbiddenException('You cannot approve or reject your own decision.');
      }
      if (!membership || !APPROVE_ROLES.includes(membership.role)) {
        throw new ForbiddenException(
          'Only an owner or executive can approve or reject a restricted decision.',
        );
      }
    }

    try {
      const updated = await prisma.decision.update({
        where: { id: decisionId, tenantId, version },
        data: {
          ...data,
          effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
          status,
          approvedById: status ? actingUserId : undefined,
          approvalNote: status ? approvalNote : undefined,
          decidedAt: status ? new Date() : undefined,
          updatedById: actingUserId,
          version: { increment: 1 },
        },
      });
      if (status) {
        await recordAuditEvent(tenantId, {
          actorId: actingUserId,
          action: status === 'APPROVED' ? 'decision_approved' : 'decision_rejected',
          objectType: 'Decision',
          objectId: updated.id,
          before: current,
          after: updated,
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This decision was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }
}
