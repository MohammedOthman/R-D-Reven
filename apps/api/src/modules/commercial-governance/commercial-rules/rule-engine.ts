import { UnprocessableEntityException } from '@nestjs/common';

// RULE-01: "approved condition/operator catalog" — a fixed, small,
// explainable set, deliberately not arbitrary code, so evaluation stays
// safe and RULE-04's "explain rule evaluation as inputs, conditions,
// result and version" stays reproducible.
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

export interface ConditionTrace {
  field: string;
  operator: RuleOperator;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface RuleEvaluationResult {
  result: boolean;
  trace: ConditionTrace[];
}

/** RULE-01: "invalid/ambiguous conditions rejected" — validated once, at creation/edit time, not re-validated on every evaluation. */
export function assertValidDefinition(definition: unknown): asserts definition is RuleDefinition {
  if (typeof definition !== 'object' || definition === null) {
    throw new UnprocessableEntityException('A rule definition must be an object.');
  }
  const { combinator, conditions } = definition as Record<string, unknown>;
  if (combinator !== 'AND' && combinator !== 'OR') {
    throw new UnprocessableEntityException('A rule definition needs combinator "AND" or "OR".');
  }
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new UnprocessableEntityException('A rule definition needs at least one condition.');
  }
  for (const condition of conditions) {
    if (typeof condition !== 'object' || condition === null) {
      throw new UnprocessableEntityException('Each condition must be an object.');
    }
    const { field, operator, value } = condition as Record<string, unknown>;
    if (typeof field !== 'string' || !field.trim()) {
      throw new UnprocessableEntityException('Each condition needs a non-empty field name.');
    }
    if (!RULE_OPERATORS.includes(operator as RuleOperator)) {
      throw new UnprocessableEntityException(
        `"${String(operator)}" is not an approved operator. Use one of: ${RULE_OPERATORS.join(', ')}.`,
      );
    }
    if (value === undefined) {
      throw new UnprocessableEntityException('Each condition needs a comparison value.');
    }
  }
}

function evaluateCondition(condition: RuleCondition, input: Record<string, unknown>): ConditionTrace {
  const actual = input[condition.field];
  let passed: boolean;
  switch (condition.operator) {
    case 'eq':
      passed = actual === condition.value;
      break;
    case 'ne':
      passed = actual !== condition.value;
      break;
    case 'gt':
      passed = typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value;
      break;
    case 'gte':
      passed = typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value;
      break;
    case 'lt':
      passed = typeof actual === 'number' && typeof condition.value === 'number' && actual < condition.value;
      break;
    case 'lte':
      passed = typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value;
      break;
    case 'in':
      passed = Array.isArray(condition.value) && condition.value.includes(actual);
      break;
    case 'contains':
      passed = typeof actual === 'string' && typeof condition.value === 'string' && actual.includes(condition.value);
      break;
  }
  return { field: condition.field, operator: condition.operator, expected: condition.value, actual, passed };
}

/** RULE-04: "explain rule evaluation as inputs, conditions, result and version" — `trace` is that explanation. */
export function evaluateRule(
  definition: RuleDefinition,
  input: Record<string, unknown>,
): RuleEvaluationResult {
  const trace = definition.conditions.map((condition) => evaluateCondition(condition, input));
  const result = definition.combinator === 'AND' ? trace.every((t) => t.passed) : trace.some((t) => t.passed);
  return { result, trace };
}
