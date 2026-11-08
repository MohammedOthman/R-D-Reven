import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

const commercialRuleFindFirst = vi.fn();
const commercialRuleCreate = vi.fn();
const commercialRuleUpdate = vi.fn();
const commercialRuleVersionFindFirst = vi.fn();
const commercialRuleVersionFindMany = vi.fn();
const commercialRuleVersionCreate = vi.fn();
const commercialRuleVersionUpdate = vi.fn();
const membershipFindFirst = vi.fn();

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(`Prisma error ${code}`);
    this.code = code;
  }
}

vi.mock('@revn/db', () => ({
  prisma: {
    commercialRule: {
      findFirst: (...args: unknown[]) => commercialRuleFindFirst(...args),
      create: (...args: unknown[]) => commercialRuleCreate(...args),
      update: (...args: unknown[]) => commercialRuleUpdate(...args),
    },
    commercialRuleVersion: {
      findFirst: (...args: unknown[]) => commercialRuleVersionFindFirst(...args),
      findMany: (...args: unknown[]) => commercialRuleVersionFindMany(...args),
      create: (...args: unknown[]) => commercialRuleVersionCreate(...args),
      update: (...args: unknown[]) => commercialRuleVersionUpdate(...args),
    },
    membership: { findFirst: (...args: unknown[]) => membershipFindFirst(...args) },
  },
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const { CommercialRulesService } = await import(
  '../src/modules/commercial-governance/commercial-rules/commercial-rules.service'
);

const validDefinition = {
  combinator: 'AND',
  conditions: [{ field: 'amount', operator: 'gte', value: 100 }],
};

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    tenantId: 'tenant-1',
    name: 'Standard eligibility',
    type: 'ELIGIBILITY',
    version: 1,
    ...overrides,
  };
}

function ruleVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-version-1',
    tenantId: 'tenant-1',
    commercialRuleId: 'rule-1',
    versionNumber: 1,
    precedence: 0,
    definition: validDefinition,
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    approvalStatus: 'DRAFT',
    testResults: null,
    version: 1,
    ...overrides,
  };
}

describe('CommercialRulesService.create/update', () => {
  beforeEach(() => {
    commercialRuleCreate.mockReset();
    commercialRuleFindFirst.mockReset();
    commercialRuleUpdate.mockReset();
  });

  it('creates a commercial rule', async () => {
    commercialRuleCreate.mockResolvedValue(rule());
    const service = new CommercialRulesService();

    await service.create('tenant-1', { name: 'Standard eligibility', type: 'ELIGIBILITY' }, 'user-1');

    expect(commercialRuleCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Standard eligibility' }) }),
    );
  });

  it('maps a version mismatch on rename to ConflictException', async () => {
    commercialRuleFindFirst.mockResolvedValue(rule());
    commercialRuleUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new CommercialRulesService();

    await expect(
      service.update('tenant-1', 'rule-1', { version: 1, name: 'Renamed' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('CommercialRulesService.createVersion — RULE-01 validation', () => {
  beforeEach(() => {
    commercialRuleFindFirst.mockReset();
    commercialRuleVersionFindFirst.mockReset();
    commercialRuleVersionCreate.mockReset();
  });

  it('rejects a definition with an operator outside the approved catalog', async () => {
    commercialRuleFindFirst.mockResolvedValue(rule());
    const service = new CommercialRulesService();

    await expect(
      service.createVersion(
        'tenant-1',
        'rule-1',
        {
          definition: { combinator: 'AND', conditions: [{ field: 'x', operator: 'regex', value: '.*' }] },
          effectiveFrom: '2026-01-01',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(commercialRuleVersionCreate).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the rule does not exist', async () => {
    commercialRuleFindFirst.mockResolvedValue(null);
    const service = new CommercialRulesService();

    await expect(
      service.createVersion(
        'tenant-1',
        'missing',
        { definition: validDefinition, effectiveFrom: '2026-01-01' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('numbers a version one past the last existing version', async () => {
    commercialRuleFindFirst.mockResolvedValue(rule());
    commercialRuleVersionFindFirst.mockResolvedValue({ versionNumber: 2 });
    commercialRuleVersionCreate.mockResolvedValue(ruleVersion({ versionNumber: 3 }));
    const service = new CommercialRulesService();

    await service.createVersion(
      'tenant-1',
      'rule-1',
      { definition: validDefinition, effectiveFrom: '2026-01-01' },
      'user-1',
    );

    expect(commercialRuleVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ versionNumber: 3 }) }),
    );
  });
});

describe('CommercialRulesService.updateVersion — RBAC, immutability and overlap', () => {
  beforeEach(() => {
    commercialRuleVersionFindFirst.mockReset();
    commercialRuleVersionFindMany.mockReset();
    commercialRuleVersionUpdate.mockReset();
    membershipFindFirst.mockReset();
  });

  it('rejects a Manager trying to approve (only Owner/Admin/Reviewer may)', async () => {
    commercialRuleVersionFindFirst.mockResolvedValue(ruleVersion());
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    const service = new CommercialRulesService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'rule-1',
        'rule-version-1',
        { version: 1, approvalStatus: 'APPROVED' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(commercialRuleVersionUpdate).not.toHaveBeenCalled();
  });

  it('rejects editing content on an already-approved version', async () => {
    commercialRuleVersionFindFirst.mockResolvedValue(ruleVersion({ approvalStatus: 'APPROVED' }));
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    const service = new CommercialRulesService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'rule-1',
        'rule-version-1',
        { version: 1, precedence: 5 },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects an edited definition that fails RULE-01 validation', async () => {
    commercialRuleVersionFindFirst.mockResolvedValue(ruleVersion());
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    const service = new CommercialRulesService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'rule-1',
        'rule-version-1',
        { version: 1, definition: { combinator: 'AND', conditions: [] } },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(commercialRuleVersionUpdate).not.toHaveBeenCalled();
  });

  it('rejects approving a version whose effective dates overlap an already-approved sibling', async () => {
    commercialRuleVersionFindFirst.mockResolvedValue(
      ruleVersion({ effectiveFrom: new Date('2026-01-01'), effectiveTo: null }),
    );
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    commercialRuleVersionFindMany.mockResolvedValue([
      ruleVersion({
        id: 'rule-version-0',
        versionNumber: 0,
        approvalStatus: 'APPROVED',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: new Date('2027-01-01'),
      }),
    ]);
    const service = new CommercialRulesService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'rule-1',
        'rule-version-1',
        { version: 1, approvalStatus: 'APPROVED' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(commercialRuleVersionUpdate).not.toHaveBeenCalled();
  });

  it('approves a non-overlapping version', async () => {
    commercialRuleVersionFindFirst.mockResolvedValue(ruleVersion());
    membershipFindFirst.mockResolvedValue({ role: 'REVIEWER' });
    commercialRuleVersionFindMany.mockResolvedValue([]);
    commercialRuleVersionUpdate.mockResolvedValue(ruleVersion({ approvalStatus: 'APPROVED' }));
    const service = new CommercialRulesService();

    const result = await service.updateVersion(
      'tenant-1',
      'rule-1',
      'rule-version-1',
      { version: 1, approvalStatus: 'APPROVED' },
      'user-1',
    );

    expect(result.approvalStatus).toBe('APPROVED');
    expect(commercialRuleVersionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approvalStatus: 'APPROVED', approvedById: 'user-1' }),
      }),
    );
  });

  it('maps a version mismatch to ConflictException', async () => {
    commercialRuleVersionFindFirst.mockResolvedValue(ruleVersion());
    membershipFindFirst.mockResolvedValue({ role: 'MANAGER' });
    commercialRuleVersionUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new CommercialRulesService();

    await expect(
      service.updateVersion(
        'tenant-1',
        'rule-1',
        'rule-version-1',
        { version: 1, precedence: 3 },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('CommercialRulesService.testVersion — RULE-02', () => {
  beforeEach(() => {
    commercialRuleVersionFindFirst.mockReset();
    commercialRuleVersionUpdate.mockReset();
  });

  it('throws NotFoundException when the version does not exist', async () => {
    commercialRuleVersionFindFirst.mockResolvedValue(null);
    const service = new CommercialRulesService();

    await expect(
      service.testVersion(
        'tenant-1',
        'rule-1',
        'missing',
        { cases: [{ input: { amount: 200 }, expectedResult: true }] },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('runs each sample case through the stored definition and records pass/fail', async () => {
    commercialRuleVersionFindFirst.mockResolvedValue(ruleVersion());
    commercialRuleVersionUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...ruleVersion(), ...data }),
    );
    const service = new CommercialRulesService();

    const result = await service.testVersion(
      'tenant-1',
      'rule-1',
      'rule-version-1',
      {
        cases: [
          { label: 'passes', input: { amount: 200 }, expectedResult: true },
          { label: 'fails', input: { amount: 10 }, expectedResult: true },
        ],
      },
      'user-1',
    );

    const testResults = result.testResults as { cases: { label: string; passed: boolean }[] };
    expect(testResults.cases).toHaveLength(2);
    expect(testResults.cases[0]).toMatchObject({ label: 'passes', passed: true });
    expect(testResults.cases[1]).toMatchObject({ label: 'fails', passed: false });
  });
});
