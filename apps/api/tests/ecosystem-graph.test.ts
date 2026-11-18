import { describe, expect, it } from 'vitest';
import {
  CALCULATION_VERSION,
  blindToken,
  buildSimilarityGraph,
  idfCosine,
  idfWeights,
  normalizeDomain,
  normalizeFeatures,
  overlapMatrix,
  pathToOrigin,
  scorePairs,
  topKUnion,
  type EntityFeatures,
  type SignalWeight,
} from '../src/modules/intelligence/ecosystem-graph';

// Synthetic accounts. Shaped like an Apollo export (tools, topics, NAICS,
// lists) but invented, so no licensed or personal data sits in this repo.
const accounts: EntityFeatures[] = [
  {
    id: 'pay-a',
    label: 'Pay A',
    features: {
      tech: ['Java', 'Kubernetes', 'Taleo', 'ESLint', 'Kafka'],
      topics: ['bnpl', 'installments', 'payments'],
      naics: ['5222'],
      lists: ['co-sell q3'],
    },
  },
  {
    id: 'pay-b',
    label: 'Pay B',
    features: {
      tech: ['java', 'kubernetes', 'taleo', 'eslint', ' java '],
      topics: ['bnpl', 'payments', 'merchant'],
      naics: ['5222'],
      lists: ['co-sell q3'],
    },
  },
  {
    id: 'shop-c',
    label: 'Shop C',
    features: {
      tech: ['java', 'kubernetes', 'laravel', 'algolia'],
      topics: ['ecommerce', 'merchant', 'storefront'],
      naics: ['5415'],
      lists: [],
    },
  },
  {
    id: 'gov-d',
    label: 'Gov D',
    features: {
      tech: ['java', 'kubernetes', 'oracle', 'sap'],
      topics: ['government', 'workforce'],
      naics: ['5416'],
      lists: [],
    },
  },
];

const signals: SignalWeight[] = [
  { family: 'tech', weight: 0.4, method: 'idf' },
  { family: 'topics', weight: 0.35, method: 'idf' },
  { family: 'naics', weight: 0.15, method: 'jaccard' },
  { family: 'lists', weight: 0.1, method: 'jaccard' },
];

describe('normalizeFeatures', () => {
  it('lowercases, trims and dedupes repeated Apollo entries', () => {
    expect(normalizeFeatures([' Java ', 'java', 'JAVA', '', 'Go'])).toEqual(['java', 'go']);
  });
});

describe('idf coupling', () => {
  it('gives a feature every entity shares zero weight', () => {
    const w = idfWeights([['java', 'taleo'], ['java', 'taleo'], ['java']]);
    expect(w.get('java')).toBe(0);
    expect(w.get('taleo')).toBeCloseTo(Math.log(3 / 2));
  });

  it('scores two entities that share only universal tools as unrelated', () => {
    const w = idfWeights([['java'], ['java'], ['java', 'go']]);
    expect(idfCosine(['java'], ['java'], w).score).toBe(0);
  });

  it('orders evidence rarest first and drops zero-weight features', () => {
    const sets = [
      ['java', 'taleo', 'kafka'],
      ['java', 'taleo', 'kafka'],
      ['java', 'kafka'],
      ['java'],
    ];
    const w = idfWeights(sets);
    expect(idfCosine(sets[0]!, sets[1]!, w).evidence).toEqual(['taleo', 'kafka']);
  });
});

describe('scorePairs', () => {
  it('rejects weights that do not sum to 1', () => {
    expect(() => scorePairs(accounts, [{ family: 'tech', weight: 0.5, method: 'idf' }])).toThrow(
      /sum to 1/,
    );
  });

  it('ranks the two payments accounts as the closest pair and keeps per-signal evidence', () => {
    const edges = scorePairs(accounts, signals).sort((a, b) => b.score - a.score);
    const top = edges[0]!;
    expect([top.source, top.target].sort()).toEqual(['pay-a', 'pay-b']);
    const tech = top.components.find((c) => c.family === 'tech')!;
    expect(tech.evidence).toContain('taleo');
    expect(tech.evidence).not.toContain('java');
    for (const e of edges) {
      expect(e.score).toBeGreaterThanOrEqual(0);
      expect(e.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('graph assembly', () => {
  it('keeps the union of each node’s top-k edges', () => {
    const edges = scorePairs(accounts, signals);
    const kept = topKUnion(edges, 1);
    expect(kept.length).toBeGreaterThanOrEqual(2);
    expect(kept.length).toBeLessThanOrEqual(accounts.length);
  });

  it('puts the payments pair in one community and stamps provenance', () => {
    const g = buildSimilarityGraph(accounts, signals, {
      topK: 1,
      now: new Date('2026-11-18T00:00:00Z'),
    });
    const c = new Map(g.nodes.map((n) => [n.id, n.community]));
    expect(c.get('pay-a')).toBe(c.get('pay-b'));
    expect(g.provenance.calculationVersion).toBe(CALCULATION_VERSION);
    expect(g.provenance.refreshedAt).toBe('2026-11-18T00:00:00.000Z');
    expect(g.provenance.inputs).toContain('tech:idf:0.4');
  });

  it('routes the path to the origin through the strongest neighbours', () => {
    const edges = [
      { source: 'a', target: 'b', score: 0.9, components: [] },
      { source: 'b', target: 'c', score: 0.9, components: [] },
      { source: 'a', target: 'c', score: 0.1, components: [] },
    ];
    expect(pathToOrigin('a', edges).get('c')).toBe('b');
  });
});

describe('account mapping overlap', () => {
  it('normalizes domains to one match key', () => {
    expect(normalizeDomain('https://www.Geidea.net/en?x=1')).toBe('geidea.net');
    expect(blindToken('WWW.example.com', 'k')).toBe(blindToken('example.com/', 'k'));
  });

  it('counts overlaps per population pair and suppresses small cells', () => {
    const own = [
      { owner: 'us', name: 'Customers', domains: ['a.com', 'b.com', 'c.com', 'd.com'] },
      { owner: 'us', name: 'Prospects', domains: ['x.com', 'y.com'] },
    ];
    const partner = [
      { owner: 'them', name: 'Customers', domains: ['www.a.com', 'b.com', 'c.com', 'x.com'] },
    ];
    const cells = overlapMatrix(own, partner, 'grant-key', 3);
    expect(cells).toEqual([
      { ownPopulation: 'Customers', partnerPopulation: 'Customers', count: 3 },
      { ownPopulation: 'Prospects', partnerPopulation: 'Customers', count: null },
    ]);
  });

  it('produces different tokens under different grant keys', () => {
    expect(blindToken('a.com', 'k1')).not.toBe(blindToken('a.com', 'k2'));
  });
});
