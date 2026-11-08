import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  prisma,
  type Agreement,
  type AgreementStatus,
  type AgreementVersion,
  type MembershipRole,
} from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';
import { rangesOverlap } from '../date-range';

export interface CreateAgreementInput {
  partnershipId: string;
  sourceRef?: string;
}

export interface UpdateAgreementInput {
  version: number;
  status?: 'IN_REVIEW' | 'CAPTURED' | 'SUSPENDED' | 'EFFECTIVE' | 'EXPIRED' | 'TERMINATED';
  transitionReason?: string;
  sourceRef?: string;
}

export interface CreateAgreementVersionInput {
  initiativeId?: string;
  terms?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface UpdateAgreementVersionInput {
  version: number;
  approvalStatus?: 'APPROVED';
  terms?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

/**
 * Table 13's Agreement row draws one arrow-chain (Captured → In Review →
 * Effective → Amended → Suspended → Expired → Terminated) with no reverse
 * moves, the same literal-vs-recovery gap every prior state machine in this
 * codebase has had — Suspended⇄Effective is the one added recovery move
 * (documented deviation, matching Partnership/Initiative/Action/Outcome).
 * Effective and Amended are deliberately NOT manually settable here —
 * they're the side effect of approving an AgreementVersion (see
 * `updateVersion` below), never a direct PATCH.
 */
const VALID_TRANSITIONS: Record<AgreementStatus, AgreementStatus[]> = {
  CAPTURED: ['IN_REVIEW', 'TERMINATED'],
  IN_REVIEW: ['CAPTURED', 'TERMINATED'],
  EFFECTIVE: ['SUSPENDED', 'EXPIRED', 'TERMINATED'],
  AMENDED: ['SUSPENDED', 'EXPIRED', 'TERMINATED'],
  SUSPENDED: ['EFFECTIVE', 'TERMINATED'],
  EXPIRED: [],
  TERMINATED: [],
};

// A version can only be approved while the parent is actually open for it —
// not before review has started, not after the agreement has exited.
const APPROVABLE_AGREEMENT_STATUSES: AgreementStatus[] = ['IN_REVIEW', 'EFFECTIVE', 'AMENDED'];

// §2.3's "Agreements/rules" row: Admin=Admin (full), Executive=Read,
// Manager=Metadata (drafts, edits, never approves), Reviewer=Review/approve
// (the "Legal Reviewer" persona) — approval authority sits with Reviewer
// here, unlike Decisions (Owner/Executive) or Outcomes (Owner/Admin/
// Reviewer-if-assigned). Both roles reach the same PATCH route (mirrors
// DecisionsController's WRITE_OR_APPROVE union); this service enforces
// which of the two a given request may actually do.
const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const APPROVE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'REVIEWER'];

function nextStatusAfterApproval(current: AgreementStatus): AgreementStatus {
  return current === 'IN_REVIEW' ? 'EFFECTIVE' : 'AMENDED';
}

@Injectable()
export class AgreementsService {
  private readonly logger = new Logger(AgreementsService.name);

  list(tenantId: string, partnershipId?: string): Promise<Agreement[]> {
    return prisma.agreement.findMany({
      where: { tenantId, ...(partnershipId ? { partnershipId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, agreementId: string) {
    const agreement = await prisma.agreement.findFirst({
      where: { id: agreementId, tenantId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!agreement) {
      throw new NotFoundException('Agreement not found.');
    }
    return agreement;
  }

  private async getPlain(tenantId: string, agreementId: string): Promise<Agreement> {
    const agreement = await prisma.agreement.findFirst({ where: { id: agreementId, tenantId } });
    if (!agreement) {
      throw new NotFoundException('Agreement not found.');
    }
    return agreement;
  }

  async create(tenantId: string, input: CreateAgreementInput, actingUserId: string): Promise<Agreement> {
    const partnership = await prisma.partnership.findFirst({
      where: { id: input.partnershipId, tenantId },
      select: { id: true },
    });
    if (!partnership) {
      throw new NotFoundException('Partnership not found.');
    }

    const agreement = await prisma.agreement.create({
      data: {
        tenantId,
        partnershipId: input.partnershipId,
        sourceRef: input.sourceRef,
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'agreement_created',
      objectType: 'Agreement',
      objectId: agreement.id,
      after: agreement,
    });
    return agreement;
  }

  async update(
    tenantId: string,
    agreementId: string,
    { version, status, transitionReason, sourceRef }: UpdateAgreementInput,
    actingUserId: string,
  ): Promise<Agreement> {
    const current = await this.getPlain(tenantId, agreementId);

    if (status && status !== current.status) {
      if (!VALID_TRANSITIONS[current.status].includes(status)) {
        throw new UnprocessableEntityException(
          `Cannot move an agreement from ${current.status} to ${status}.`,
        );
      }
    }

    try {
      const updated = await prisma.agreement.update({
        where: { id: agreementId, tenantId, version },
        data: {
          sourceRef,
          status,
          updatedById: actingUserId,
          version: { increment: 1 },
        },
      });
      if (status && status !== current.status) {
        this.logger.log(
          `agreement_status_changed agreement_id=${updated.id} from=${current.status} to=${updated.status} reason=${transitionReason ?? '(none)'}`,
        );
      }
      await recordAuditEvent(tenantId, {
        actorId: actingUserId,
        action: status && status !== current.status ? 'agreement_status_changed' : 'agreement_updated',
        objectType: 'Agreement',
        objectId: updated.id,
        before: current,
        after: updated,
      });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This agreement was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  async createVersion(
    tenantId: string,
    agreementId: string,
    input: CreateAgreementVersionInput,
    actingUserId: string,
  ): Promise<AgreementVersion> {
    const agreement = await this.getPlain(tenantId, agreementId);
    if (agreement.status === 'EXPIRED' || agreement.status === 'TERMINATED') {
      throw new UnprocessableEntityException(
        `Cannot add a version to an agreement that is ${agreement.status}.`,
      );
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

    const last = await prisma.agreementVersion.findFirst({
      where: { agreementId, tenantId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const created = await prisma.agreementVersion.create({
      data: {
        tenantId,
        agreementId,
        initiativeId: input.initiativeId,
        terms: input.terms,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
        versionNumber: (last?.versionNumber ?? 0) + 1,
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'agreement_version_created',
      objectType: 'AgreementVersion',
      objectId: created.id,
      after: created,
    });
    return created;
  }

  async updateVersion(
    tenantId: string,
    agreementId: string,
    versionId: string,
    { version, approvalStatus, terms, effectiveFrom, effectiveTo }: UpdateAgreementVersionInput,
    actingUserId: string,
  ): Promise<AgreementVersion> {
    const current = await prisma.agreementVersion.findFirst({
      where: { id: versionId, agreementId, tenantId },
    });
    if (!current) {
      throw new NotFoundException('Agreement version not found.');
    }
    const membership = await prisma.membership.findFirst({
      where: { tenantId, userId: actingUserId, status: 'ACTIVE' },
    });
    const isApproving = approvalStatus === 'APPROVED';
    const allowedRoles = isApproving ? APPROVE_ROLES : WRITE_ROLES;
    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        isApproving
          ? 'Only an owner, admin or reviewer can approve an agreement version.'
          : 'Only an owner, admin or manager can edit an agreement version.',
      );
    }

    // INV-002: an effective (approved) version cannot be edited — only a
    // still-draft version's content is mutable.
    const editingContent = terms !== undefined || effectiveFrom !== undefined || effectiveTo !== undefined;
    if (editingContent && current.approvalStatus === 'APPROVED') {
      throw new UnprocessableEntityException(
        'This version is already approved and immutable — create a new version instead.',
      );
    }

    const effectiveData: Prisma.AgreementVersionUncheckedUpdateInput = {
      terms,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
      effectiveTo: effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : undefined,
      updatedById: actingUserId,
      version: { increment: 1 },
    };

    if (approvalStatus === 'APPROVED') {
      if (current.approvalStatus === 'APPROVED') {
        throw new UnprocessableEntityException('This version is already approved.');
      }
      const agreement = await this.getPlain(tenantId, agreementId);
      if (!APPROVABLE_AGREEMENT_STATUSES.includes(agreement.status)) {
        throw new UnprocessableEntityException(
          `Cannot approve a version while the agreement is ${agreement.status}.`,
        );
      }

      const candidateFrom = effectiveFrom ? new Date(effectiveFrom) : current.effectiveFrom;
      const candidateTo =
        effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : current.effectiveTo;
      const siblings = await prisma.agreementVersion.findMany({
        where: { agreementId, tenantId, approvalStatus: 'APPROVED', id: { not: versionId } },
      });
      const conflict = siblings.find((s) =>
        rangesOverlap(candidateFrom, candidateTo, s.effectiveFrom, s.effectiveTo),
      );
      if (conflict) {
        throw new UnprocessableEntityException(
          `This version's effective dates overlap with an already-approved version (v${conflict.versionNumber}).`,
        );
      }

      effectiveData.approvalStatus = 'APPROVED';
      effectiveData.approvedById = actingUserId;
      effectiveData.approvedAt = new Date();

      try {
        const [updated] = await prisma.$transaction([
          prisma.agreementVersion.update({ where: { id: versionId, tenantId, version }, data: effectiveData }),
          prisma.agreement.update({
            where: { id: agreementId, tenantId },
            data: { status: nextStatusAfterApproval(agreement.status), updatedById: actingUserId },
          }),
        ]);
        await recordAuditEvent(tenantId, {
          actorId: actingUserId,
          action: 'agreement_version_approved',
          objectType: 'AgreementVersion',
          objectId: updated.id,
          before: current,
          after: updated,
        });
        return updated;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new ConflictException(
            'This version was changed by someone else. Refresh and try again.',
          );
        }
        throw error;
      }
    }

    try {
      const updated = await prisma.agreementVersion.update({
        where: { id: versionId, tenantId, version },
        data: effectiveData,
      });
      await recordAuditEvent(tenantId, {
        actorId: actingUserId,
        action: 'agreement_version_updated',
        objectType: 'AgreementVersion',
        objectId: updated.id,
        before: current,
        after: updated,
      });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException('This version was changed by someone else. Refresh and try again.');
      }
      throw error;
    }
  }
}
