import { describe, expect, it } from 'vitest';
import { UnprocessableEntityException } from '@nestjs/common';
import { assertValidDefinition, evaluateRule } from '../src/modules/commercial-governance/commercial-rules/rule-engine';

describe('assertValidDefinition', () => {
  it('rejects a non-object definition', () => {
    expect(() => assertValidDefinition('nope')).toThrow(UnprocessableEntityException);
  });

  it('rejects a combinator that is not AND/OR', () => {
    expect(() =>
      assertValidDefinition({ combinator: 'XOR', conditions: [{ field: 'a', operator: 'eq', value: 1 }] }),
    ).toThrow(UnprocessableEntityException);
  });

  it('rejects an empty conditions array', () => {
    expect(() => assertValidDefinition({ combinator: 'AND', conditions: [] })).toThrow(
      UnprocessableEntityException,
    );
  });

  it('rejects an operator outside the approved catalog', () => {
    expect(() =>
      assertValidDefinition({
        combinator: 'AND',
        conditions: [{ field: 'amount', operator: 'regex', value: '.*' }],
      }),
    ).toThrow(UnprocessableEntityException);
  });

  it('rejects a condition missing a comparison value', () => {
    expect(() =>
      assertValidDefinition({ combinator: 'AND', conditions: [{ field: 'amount', operator: 'eq' }] }),
    ).toThrow(UnprocessableEntityException);
  });

  it('accepts a well-formed definition', () => {
    expect(() =>
      assertValidDefinition({
        combinator: 'AND',
        conditions: [{ field: 'amount', operator: 'gte', value: 100 }],
      }),
    ).not.toThrow();
  });
});

describe('evaluateRule', () => {
  it('ANDs conditions together, requiring every one to pass', () => {
    const definition = {
      combinator: 'AND' as const,
      conditions: [
        { field: 'amount', operator: 'gte' as const, value: 100 },
        { field: 'region', operator: 'eq' as const, value: 'EMEA' },
      ],
    };
    expect(evaluateRule(definition, { amount: 150, region: 'EMEA' }).result).toBe(true);
    expect(evaluateRule(definition, { amount: 50, region: 'EMEA' }).result).toBe(false);
  });

  it('ORs conditions together, requiring only one to pass', () => {
    const definition = {
      combinator: 'OR' as const,
      conditions: [
        { field: 'tier', operator: 'eq' as const, value: 'GOLD' },
        { field: 'amount', operator: 'gt' as const, value: 10000 },
      ],
    };
    expect(evaluateRule(definition, { tier: 'SILVER', amount: 20000 }).result).toBe(true);
    expect(evaluateRule(definition, { tier: 'SILVER', amount: 5000 }).result).toBe(false);
  });

  it('evaluates "in" and "contains" operators', () => {
    const definition = {
      combinator: 'AND' as const,
      conditions: [
        { field: 'region', operator: 'in' as const, value: ['EMEA', 'APAC'] },
        { field: 'name', operator: 'contains' as const, value: 'Globex' },
      ],
    };
    expect(evaluateRule(definition, { region: 'APAC', name: 'Globex Consolidated' }).result).toBe(true);
    expect(evaluateRule(definition, { region: 'NA', name: 'Globex Consolidated' }).result).toBe(false);
  });

  it('produces one trace entry per condition, explaining pass/fail', () => {
    const definition = {
      combinator: 'AND' as const,
      conditions: [{ field: 'amount', operator: 'gte' as const, value: 100 }],
    };
    const { trace } = evaluateRule(definition, { amount: 50 });
    expect(trace).toEqual([
      { field: 'amount', operator: 'gte', expected: 100, actual: 50, passed: false },
    ]);
  });

  it('treats a missing input field as failing a numeric comparison rather than throwing', () => {
    const definition = {
      combinator: 'AND' as const,
      conditions: [{ field: 'amount', operator: 'gt' as const, value: 0 }],
    };
    expect(evaluateRule(definition, {}).result).toBe(false);
  });
});
