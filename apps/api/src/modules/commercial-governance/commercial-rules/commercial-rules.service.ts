import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  prisma,
  type CommercialRule,
  type CommercialRuleVersion,
  type MembershipRole,
} from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';
import { rangesOverlap } from '../date-range';
import { assertValidDefinition, evaluateRule, type RuleDefinition } from './rule-engine';

export interface CreateCommercialRuleInput {
  name: string;
  type: 'ELIGIBILITY' | 'ATTRIBUTION';
}

export interface UpdateCommercialRuleInput {
  version: number;
  name?: string;
}

export interface CreateCommercialRuleVersionInput {
  definition: unknown;
  precedence?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface UpdateCommercialRuleVersionInput {
  version: number;
  approvalStatus?: 'APPROVED';
  definition?: unknown;
  precedence?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface TestCase {
  label?: string;
  input: Record<string, unknown>;
  expectedResult: boolean;
}

export interface TestCommercialRuleVersionInput {
  cases: TestCase[];
}

// Same "Agreements/rules" RBAC row as AgreementsService — §6.8 groups
// Agreements and Commercial Rules under one requirement section and one
// matrix row, and Table 7's Legal Reviewer persona explicitly covers both
// ("agreement metadata, obligations, commercial rules and approval
// history").
const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const APPROVE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'REVIEWER'];

@Injectable()
export class CommercialRulesService {
  list(tenantId: string): Promise<CommercialRule[]> {
    return prisma.commercialRule.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async get(tenantId: string, ruleId: string) {
    const rule = await prisma.commercialRule.findFirst({
      where: { id: ruleId, tenantId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!rule) {
      throw new NotFoundException('Commercial rule not found.');
    }
    return rule;
  }

  private async getPlain(tenantId: string, ruleId: string): Promise<CommercialRule> {
    const rule = await prisma.commercialRule.findFirst({ where: { id: ruleId, tenantId } });
    if (!rule) {
      throw new NotFoundException('Commercial rule not found.');
    }
    return rule;
  }

  async create(
    tenantId: string,
    input: CreateCommercialRuleInput,
    actingUserId: string,
  ): Promise<CommercialRule> {
    const rule = await prisma.commercialRule.create({
      data: {
        tenantId,
        name: input.name,
        type: input.type,
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'commercial_rule_created',
      objectType: 'CommercialRule',
      objectId: rule.id,
      after: rule,
    });
    return rule;
  }

  async update(
    tenantId: string,
    ruleId: string,
    { version, name }: UpdateCommercialRuleInput,
    actingUserId: string,
  ): Promise<CommercialRule> {
    const current = await this.getPlain(tenantId, ruleId);
    try {
      const updated = await prisma.commercialRule.update({
        where: { id: ruleId, tenantId, version },
        data: { name, updatedById: actingUserId, version: { increment: 1 } },
      });
      await recordAuditEvent(tenantId, {
        actorId: actingUserId,
        action: 'commercial_rule_updated',
        objectType: 'CommercialRule',
        objectId: updated.id,
        before: current,
        after: updated,
      });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This commercial rule was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  async createVersion(
    tenantId: string,
    ruleId: string,
    input: CreateCommercialRuleVersionInput,
    actingUserId: string,
  ): Promise<CommercialRuleVersion> {
    await this.getPlain(tenantId, ruleId);
    assertValidDefinition(input.definition);

    const last = await prisma.commercialRuleVersion.findFirst({
      where: { commercialRuleId: ruleId, tenantId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const created = await prisma.commercialRuleVersion.create({
      data: {
        tenantId,
        commercialRuleId: ruleId,
        definition: input.definition as unknown as Prisma.InputJsonValue,
        precedence: input.precedence ?? 0,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
        versionNumber: (last?.versionNumber ?? 0) + 1,
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'commercial_rule_version_created',
      objectType: 'CommercialRuleVersion',
      objectId: created.id,
      after: created,
    });
    return created;
  }

  async updateVersion(
    tenantId: string,
    ruleId: string,
    versionId: string,
    { version, approvalStatus, definition, precedence, effectiveFrom, effectiveTo }: UpdateCommercialRuleVersionInput,
    actingUserId: string,
  ): Promise<CommercialRuleVersion> {
    const current = await prisma.commercialRuleVersion.findFirst({
      where: { id: versionId, commercialRuleId: ruleId, tenantId },
    });
    if (!current) {
      throw new NotFoundException('Commercial rule version not found.');
    }
    const membership = await prisma.membership.findFirst({
      where: { tenantId, userId: actingUserId, status: 'ACTIVE' },
    });
    const isApproving = approvalStatus === 'APPROVED';
    const allowedRoles = isApproving ? APPROVE_ROLES : WRITE_ROLES;
    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        isApproving
          ? 'Only an owner, admin or reviewer can approve a commercial rule version.'
          : 'Only an owner, admin or manager can edit a commercial rule version.',
      );
    }

    const editingContent =
      definition !== undefined || precedence !== undefined || effectiveFrom !== undefined || effectiveTo !== undefined;
    if (editingContent && current.approvalStatus === 'APPROVED') {
      throw new UnprocessableEntityException(
        'This version is already approved and immutable — create a new version instead.',
      );
    }
    if (definition !== undefined) {
      assertValidDefinition(definition);
    }

    const data: Prisma.CommercialRuleVersionUncheckedUpdateInput = {
      definition: definition !== undefined ? (definition as unknown as Prisma.InputJsonValue) : undefined,
      precedence,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
      effectiveTo: effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : undefined,
      updatedById: actingUserId,
      version: { increment: 1 },
    };

    if (isApproving) {
      if (current.approvalStatus === 'APPROVED') {
        throw new UnprocessableEntityException('This version is already approved.');
      }
      const candidateFrom = effectiveFrom ? new Date(effectiveFrom) : current.effectiveFrom;
      const candidateTo =
        effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : current.effectiveTo;
      const siblings = await prisma.commercialRuleVersion.findMany({
        where: { commercialRuleId: ruleId, tenantId, approvalStatus: 'APPROVED', id: { not: versionId } },
      });
      const conflict = siblings.find((s) =>
        rangesOverlap(candidateFrom, candidateTo, s.effectiveFrom, s.effectiveTo),
      );
      if (conflict) {
        throw new UnprocessableEntityException(
          `This version's effective dates overlap with an already-approved version (v${conflict.versionNumber}).`,
        );
      }
      data.approvalStatus = 'APPROVED';
      data.approvedById = actingUserId;
      data.approvedAt = new Date();
    }

    try {
      const updated = await prisma.commercialRuleVersion.update({
        where: { id: versionId, tenantId, version },
        data,
      });
      await recordAuditEvent(tenantId, {
        actorId: actingUserId,
        action: isApproving ? 'commercial_rule_version_approved' : 'commercial_rule_version_updated',
        objectType: 'CommercialRuleVersion',
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

  /** RULE-02: test against sample cases before approval — see docs/DECISIONS.md for why "historical events" is scoped to user-supplied samples. */
  async testVersion(
    tenantId: string,
    ruleId: string,
    versionId: string,
    input: TestCommercialRuleVersionInput,
    actingUserId: string,
  ): Promise<CommercialRuleVersion> {
    const current = await prisma.commercialRuleVersion.findFirst({
      where: { id: versionId, commercialRuleId: ruleId, tenantId },
    });
    if (!current) {
      throw new NotFoundException('Commercial rule version not found.');
    }

    const definition = current.definition as unknown as RuleDefinition;
    const results = input.cases.map((testCase) => {
      const { result, trace } = evaluateRule(definition, testCase.input);
      return {
        label: testCase.label,
        input: testCase.input,
        expectedResult: testCase.expectedResult,
        actualResult: result,
        passed: result === testCase.expectedResult,
        trace,
      };
    });
    const testResults = { ranAt: new Date().toISOString(), cases: results };

    const updated = await prisma.commercialRuleVersion.update({
      where: { id: versionId, tenantId },
      data: { testResults: testResults as unknown as Prisma.InputJsonValue, updatedById: actingUserId },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'commercial_rule_version_tested',
      objectType: 'CommercialRuleVersion',
      objectId: updated.id,
      after: testResults,
    });
    return updated;
  }
}
