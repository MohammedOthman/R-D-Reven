export type CommercialRuleType = 'ELIGIBILITY' | 'ATTRIBUTION';

export const COMMERCIAL_RULE_TYPES: CommercialRuleType[] = ['ELIGIBILITY', 'ATTRIBUTION'];

/** RULE-01's approved condition/operator catalog — mirrors `rule-engine.ts`'s `RULE_OPERATORS`. */
export const RULE_OPERATORS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

export interface RuleDefinition {
  combinator: 'AND' | 'OR';
  conditions: RuleCondition[];
}

export type ApprovalStatus = 'DRAFT' | 'APPROVED';

export interface ConditionTrace {
  field: string;
  operator: RuleOperator;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface RuleTestCaseResult {
  label?: string;
  input: Record<string, unknown>;
  expectedResult: boolean;
  actualResult: boolean;
  passed: boolean;
  trace: ConditionTrace[];
}

export interface RuleTestResults {
  ranAt: string;
  cases: RuleTestCaseResult[];
}

export interface CommercialRuleVersion {
  id: string;
  commercialRuleId: string;
  versionNumber: number;
  precedence: number;
  definition: RuleDefinition;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvalStatus: ApprovalStatus;
  approvedById: string | null;
  approvedAt: string | null;
  testResults: RuleTestResults | null;
  version: number;
  createdAt: string;
}

export interface CommercialRule {
  id: string;
  name: string;
  type: CommercialRuleType;
  version: number;
  createdAt: string;
  versions?: CommercialRuleVersion[];
}
