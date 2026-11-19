import { describe, expect, it } from 'vitest';
import {
  coListing,
  idfCosine,
  idfWeights,
  jaccard,
  normalizeFeatures,
  scoreAccounts,
} from '../src/modules/intelligence/ecosystem-graph/coupling';
import {
  buildGraph,
  communities,
  layout,
  pageRank,
  topKUnion,
} from '../src/modules/intelligence/ecosystem-graph/graph';
import type {
  FeatureAccount,
  SimilarityEdge,
} from '../src/modules/intelligence/ecosystem-graph/ecosystem-graph.types';

const account = (id: string, overrides: Partial<FeatureAccount> = {}): FeatureAccount => ({
  id,
  name: id,
  technologies: [],
  keywords: [],
  industryCodes: [],
  lists: [],
  ...overrides,
});

const edge = (source: string, target: string, score: number): SimilarityEdge => ({
  source,
  target,
  score,
  components: [],
});

describe('feature normalisation and IDF coupling', () => {
  it('lowercases, trims, drops blanks and dedupes', () => {
    expect(normalizeFeatures([' Salesforce ', 'salesforce', '', 'AWS'])).toEqual([
      'salesforce',
      'aws',
    ]);
  });

  it('gives a feature every account has zero weight', () => {
    const weights = idfWeights([['java', 'taleo'], ['java'], ['java', 'kubernetes']]);
    expect(weights.get('java')).toBeCloseTo(0);
    expect(weights.get('taleo')).toBeGreaterThan(0);
    expect(weights.get('kubernetes')).toBeGreaterThan(0);
  });

  it('scores a rare shared tool above a common one', () => {
    const sets = [['java', 'taleo'], ['java', 'taleo'], ['java'], ['java']];
    const weights = idfWeights(sets);
    const rare = idfCosine(['taleo'], ['taleo'], weights);
    const common = idfCosine(['java'], ['java'], weights);
    expect(rare.score).toBeGreaterThan(common.score);
    expect(rare.evidence).toEqual(['taleo']);
  });

  it('computes Jaccard overlap with sorted evidence', () => {
    const result = jaccard(['5415', '5182'], ['5415', '7372']);
    expect(result.score).toBeCloseTo(1 / 3);
    expect(result.evidence).toEqual(['5415']);
  });

  it('ignores a list every account is on, and counts a discriminating one', () => {
    const df = new Map([
      ['everyone', 4],
      ['batch-3', 2],
    ]);
    const universal = coListing(['everyone'], ['everyone'], df, 4);
    expect(universal.score).toBe(0);
    const discriminating = coListing(['everyone', 'batch-3'], ['everyone', 'batch-3'], df, 4);
    expect(discriminating.score).toBe(1);
    expect(discriminating.evidence).toEqual(['batch-3']);
  });
});

describe('account pair scoring', () => {
  it('keeps every weighted component and sums to the weighted total', () => {
    const a = account('a', {
      technologies: ['taleo', 'eslint'],
      keywords: ['payments', 'fintech'],
      industryCodes: ['5223'],
    });
    const b = account('b', {
      technologies: ['taleo', 'eslint'],
      keywords: ['payments', 'lending'],
      industryCodes: ['5223'],
    });
    const [pair] = scoreAccounts([a, b]);
    expect(pair!.components.map((component) => component.family)).toEqual([
      'technologies',
      'keywords',
      'industries',
      'lists',
    ]);
    expect(pair!.score).toBeGreaterThan(0);
    expect(pair!.score).toBeLessThanOrEqual(1);
    const recomputed = pair!.components.reduce((sum, component) => {
      const weight =
        component.family === 'technologies'
          ? 0.4
          : component.family === 'keywords'
            ? 0.35
            : component.family === 'industries'
              ? 0.15
              : 0.1;
      return sum + weight * component.score;
    }, 0);
    expect(pair!.score).toBeCloseTo(recomputed);
  });

  it('returns an empty list for fewer than two accounts', () => {
    expect(scoreAccounts([account('only')])).toEqual([]);
  });
});

describe('graph structure', () => {
  it('keeps the strongest k edges per node without duplicates', () => {
    const edges = [edge('a', 'b', 0.9), edge('a', 'c', 0.2), edge('b', 'c', 0.8)];
    const kept = topKUnion(edges, 1);
    expect(kept).toHaveLength(2);
    expect(kept.some((item) => item.source === 'a' && item.target === 'b')).toBe(true);
    expect(kept.some((item) => item.source === 'b' && item.target === 'c')).toBe(true);
  });

  it('finds communities deterministically', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const edges = [edge('a', 'b', 0.9), edge('c', 'd', 0.9), edge('b', 'c', 0.05)];
    const first = communities(ids, edges);
    const second = communities(ids, edges);
    expect([...first.entries()]).toEqual([...second.entries()]);
    expect(first.get('a')).toBe(first.get('b'));
    expect(first.get('c')).toBe(first.get('d'));
  });

  it('normalises PageRank and ranks the hub above a leaf', () => {
    const ids = ['hub', 'a', 'b', 'c'];
    const edges = [edge('hub', 'a', 0.9), edge('hub', 'b', 0.8), edge('hub', 'c', 0.7)];
    const rank = pageRank(ids, edges);
    const total = [...rank.values()].reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(1);
    expect(rank.get('hub')!).toBeGreaterThan(rank.get('a')!);
  });

  it('produces a stable layout', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const edges = [edge('a', 'b', 0.9), edge('c', 'd', 0.8), edge('b', 'c', 0.2)];
    const groups = communities(ids, edges);
    const first = layout(ids, edges, groups);
    const second = layout(ids, edges, groups);
    for (const id of ids) {
      expect(first.get(id)).toEqual(second.get(id));
    }
  });

  it('builds a readable graph with group labels from shared terms', () => {
    const accounts = [
      account('a', { name: 'A', technologies: ['taleo'], keywords: ['payments'], headcount: 10 }),
      account('b', { name: 'B', technologies: ['taleo'], keywords: ['payments'], headcount: 20 }),
      account('c', {
        name: 'C',
        technologies: ['snowflake'],
        keywords: ['analytics'],
        headcount: 30,
      }),
      account('d', {
        name: 'D',
        technologies: ['snowflake'],
        keywords: ['analytics'],
        headcount: 40,
      }),
    ];
    const edges = [edge('a', 'b', 0.9), edge('c', 'd', 0.9)];
    const graph = buildGraph(accounts, edges);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.groups).toHaveLength(2);
    expect(graph.provenance.weights).toMatchObject({ technologies: 0.4, keywords: 0.35 });
    expect(graph.groups.every((group) => group.label.length > 0)).toBe(true);
  });
});
