import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, prisma, type MembershipRole, type Outcome, type OutcomeStatus } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface CreateOutcomeInput {
  partnershipId: string;
  initiativeId?: string;
  type: string;
  claimedResult: string;
  value?: string;
  unit?: string;
  period?: string;
}

export interface UpdateOutcomeInput {
  version: number;
  status?: 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'VERIFICATION_REQUIRED';
  verifierId?: string;
  verifierDisposition?: string;
  rejectionReason?: string;
  type?: string;
  claimedResult?: string;
  value?: string;
  unit?: string;
  period?: string;
}

// See schema.prisma's OutcomeStatus comment: Table 13's chain is read as a
// reachability list, not a strict sequence — a verifier takes one of three
// actions from Submitted, and Verification Required needs a documented
// recovery move back to Submitted once more evidence is attached, the same
// "stuck state" pattern as every prior state machine in this codebase.
const VALID_TRANSITIONS: Record<OutcomeStatus, OutcomeStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['VERIFIED', 'REJECTED', 'VERIFICATION_REQUIRED'],
  VERIFICATION_REQUIRED: ['SUBMITTED'],
  VERIFIED: [],
  REJECTED: [],
  SUPERSEDED: [],
};

// §2.3's "Evidence/outcomes" row: Manager "Create"s (drafts and submits);
// Admin/Owner have full "Admin" control throughout.
const SUBMIT_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
// Reviewer's cell is "Verify if assigned" — checked against Outcome.verifierId
// in the service, not by role alone; Admin/Owner's "Admin" cell verifies
// anything (no assignment restriction, same as everywhere else "Admin" beats
// a narrower role's gate).
const VERIFY_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'REVIEWER'];
const PLAIN_FIELDS = ['type', 'claimedResult', 'value', 'unit', 'period'] as const;

@Injectable()
export class OutcomesService {
  private readonly logger = new Logger(OutcomesService.name);

  list(
    tenantId: string,
    filters: { partnershipId?: string; initiativeId?: string },
  ): Promise<Outcome[]> {
    return prisma.outcome.findMany({
      where: { tenantId, ...filters },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, outcomeId: string): Promise<Outcome> {
    const outcome = await prisma.outcome.findFirst({
      where: { id: outcomeId, tenantId },
      include: { contributions: true, evidence: true },
    });
    if (!outcome) {
      throw new NotFoundException('Outcome not found.');
    }
    return outcome;
  }

  async create(
    tenantId: string,
    input: CreateOutcomeInput,
    actingUserId: string,
  ): Promise<Outcome> {
    const partnership = await prisma.partnership.findFirst({
      where: { id: input.partnershipId, tenantId },
      select: { id: true },
    });
    if (!partnership) {
      throw new NotFoundException('Partnership not found.');
    }
    if (input.initiativeId) {
      const initiative = await prisma.initiative.findFirst({
        where: { id: input.initiativeId, tenantId },
        select: { id: true },
      });
      if (!initiative) {
        throw new NotFoundException('Initiative not found.');
      }
    }
    // OUT-01's "type-specific validation applied" gate — no PRD-named type
    // taxonomy exists to define richer per-type rules (same ADM-05-not-built
    // gap as Decision.type), so this is the one generic rule that applies
    // regardless of type: a claimed value needs its unit, and vice versa.
    if ((input.value !== undefined) !== (input.unit !== undefined && input.unit !== '')) {
      throw new UnprocessableEntityException(
        'A claimed value and its unit must be given together.',
      );
    }

    const outcome = await prisma.outcome.create({
      data: {
        tenantId,
        partnershipId: input.partnershipId,
        initiativeId: input.initiativeId,
        type: input.type,
        claimedResult: input.claimedResult,
        value: input.value,
        unit: input.unit,
        period: input.period,
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'outcome_created',
      objectType: 'Outcome',
      objectId: outcome.id,
      after: outcome,
    });
    return outcome;
  }

  async update(
    tenantId: string,
    outcomeId: string,
    {
      version,
      status,
      verifierId,
      verifierDisposition,
      rejectionReason,
      ...fields
    }: UpdateOutcomeInput,
    actingUserId: string,
  ): Promise<Outcome> {
    const current = await this.get(tenantId, outcomeId);
    const membership = await prisma.membership.findFirst({
      where: { tenantId, userId: actingUserId, status: 'ACTIVE' },
    });

    const editingFields = PLAIN_FIELDS.some((key) => fields[key] !== undefined);
    if (editingFields) {
      if (current.status !== 'DRAFT') {
        throw new UnprocessableEntityException('An outcome can only be edited while still Draft.');
      }
      if (!membership || !SUBMIT_ROLES.includes(membership.role)) {
        throw new ForbiddenException('Only an owner, admin or manager can edit an outcome.');
      }
      if ((fields.value !== undefined) !== (fields.unit !== undefined && fields.unit !== '')) {
        throw new UnprocessableEntityException(
          'A claimed value and its unit must be given together.',
        );
      }
    }

    let data: Prisma.OutcomeUncheckedUpdateInput = {
      ...fields,
      updatedById: actingUserId,
      version: { increment: 1 },
    };

    if (status) {
      if (!VALID_TRANSITIONS[current.status].includes(status)) {
        throw new UnprocessableEntityException(
          `Cannot move an outcome from ${current.status} to ${status}.`,
        );
      }

      if (status === 'SUBMITTED') {
        // OUT-02: submit to an authorized verifier.
        if (!membership || !SUBMIT_ROLES.includes(membership.role)) {
          throw new ForbiddenException('Only an owner, admin or manager can submit an outcome.');
        }
        const effectiveVerifierId = verifierId ?? current.verifierId;
        if (!effectiveVerifierId) {
          throw new UnprocessableEntityException(
            'Submitting an outcome requires an assigned verifier.',
          );
        }
        const verifierMembership = await prisma.membership.findFirst({
          where: { tenantId, userId: effectiveVerifierId, status: 'ACTIVE' },
        });
        if (!verifierMembership || !VERIFY_ROLES.includes(verifierMembership.role)) {
          throw new UnprocessableEntityException(
            'The assigned verifier must be an owner, admin or reviewer.',
          );
        }
        data = {
          ...data,
          verifierId: effectiveVerifierId,
          submittedAt: new Date(),
        };
        this.logger.log(
          `outcome_submitted outcome_id=${current.id} verifier_id=${effectiveVerifierId}`,
        );
      } else {
        // VERIFIED / REJECTED / VERIFICATION_REQUIRED — a verifier's decision.
        if (!membership || !VERIFY_ROLES.includes(membership.role)) {
          throw new ForbiddenException('Only an owner, admin or reviewer can verify an outcome.');
        }
        // T-010 / INV-003's separation of duties: never the outcome's own creator.
        if (current.createdById === actingUserId) {
          throw new ForbiddenException('You cannot verify your own outcome.');
        }
        // Reviewer's cell is "Verify if assigned" — Owner/Admin's "Admin"
        // cell has no such assignment restriction.
        if (membership.role === 'REVIEWER' && current.verifierId !== actingUserId) {
          throw new ForbiddenException('You are not the verifier assigned to this outcome.');
        }

        if (status === 'VERIFIED') {
          // INV-003/T-009: cannot verify without at least one accessible evidence record.
          const evidenceCount = await prisma.evidence.count({ where: { tenantId, outcomeId } });
          if (evidenceCount === 0) {
            throw new UnprocessableEntityException(
              'An outcome cannot be verified without at least one linked evidence record.',
            );
          }
        }
        if (status === 'REJECTED' && !rejectionReason?.trim()) {
          throw new UnprocessableEntityException('Rejecting an outcome requires a reason.');
        }
        if (status === 'VERIFICATION_REQUIRED' && !verifierDisposition?.trim()) {
          throw new UnprocessableEntityException('Requesting more evidence requires a reason.');
        }

        data = {
          ...data,
          verifiedAt: new Date(),
          verifierDisposition,
          rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        };
        if (status === 'VERIFIED') {
          this.logger.log(`outcome_verified outcome_id=${current.id} verifier_id=${actingUserId}`);
        }
      }
      data.status = status;
    }

    try {
      const updated = await prisma.outcome.update({
        where: { id: outcomeId, tenantId, version },
        data,
      });
      if (status) {
        await recordAuditEvent(tenantId, {
          actorId: actingUserId,
          action: `outcome_${status.toLowerCase()}`,
          objectType: 'Outcome',
          objectId: updated.id,
          before: current,
          after: updated,
        });
      } else if (editingFields) {
        await recordAuditEvent(tenantId, {
          actorId: actingUserId,
          action: 'outcome_updated',
          objectType: 'Outcome',
          objectId: updated.id,
          before: current,
          after: updated,
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This outcome was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }
}
