import type {
  EdgeComponent,
  EntityFeatures,
  SignalWeight,
  SimilarityEdge,
} from './ecosystem-graph.types';

/** Lowercase, trim, and dedupe a feature list — Apollo exports repeat entries within one row. */
export function normalizeFeatures(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim().toLowerCase()).filter((v) => v.length > 0))];
}

/** ln(N / df) per feature. A feature every entity has scores 0 and adds no signal. */
export function idfWeights(sets: readonly (readonly string[])[]): Map<string, number> {
  const n = sets.length;
  const df = new Map<string, number>();
  for (const set of sets) {
    for (const f of new Set(set)) df.set(f, (df.get(f) ?? 0) + 1);
  }
  const w = new Map<string, number>();
  for (const [f, d] of df) w.set(f, Math.log(n / d));
  return w;
}

/**
 * Bibliographic coupling with IDF weighting: cosine between two binary
 * feature sets, each feature weighted by its rarity. Returns the score and
 * the shared features ordered rarest first, as evidence.
 */
export function idfCosine(
  a: readonly string[],
  b: readonly string[],
  weights: Map<string, number>,
  evidenceLimit = 8,
): { score: number; evidence: string[] } {
  const A = new Set(a);
  const B = new Set(b);
  const shared = [...A].filter((f) => B.has(f));
  const sum = (xs: Iterable<string>) => {
    let s = 0;
    for (const x of xs) s += weights.get(x) ?? 0;
    return s;
  };
  const den = Math.sqrt(sum(A) * sum(B));
  const score = den === 0 ? 0 : sum(shared) / den;
  const evidence = shared
    .filter((f) => (weights.get(f) ?? 0) > 0)
    .sort((x, y) => (weights.get(y) ?? 0) - (weights.get(x) ?? 0) || x.localeCompare(y))
    .slice(0, evidenceLimit);
  return { score, evidence };
}

export function jaccard(
  a: readonly string[],
  b: readonly string[],
): { score: number; evidence: string[] } {
  const A = new Set(a);
  const B = new Set(b);
  const shared = [...A].filter((f) => B.has(f)).sort();
  const union = new Set([...A, ...B]).size;
  return { score: union === 0 ? 0 : shared.length / union, evidence: shared };
}

/**
 * Score every pair of entities. Weights must sum to 1 so the final score
 * stays in [0, 1]; each edge keeps its per-family components so the UI can
 * show *why* two nodes connect (PRD §1.4: no black-box recommendations).
 */
export function scorePairs(
  entities: readonly EntityFeatures[],
  signals: readonly SignalWeight[],
): SimilarityEdge[] {
  const total = signals.reduce((s, x) => s + x.weight, 0);
  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(`Signal weights must sum to 1, got ${total}`);
  }
  const normalized = entities.map((e) => ({
    id: e.id,
    features: Object.fromEntries(
      signals.map((s) => [s.family, normalizeFeatures(e.features[s.family] ?? [])]),
    ) as Record<string, string[]>,
  }));
  const idf = new Map(
    signals
      .filter((s) => s.method === 'idf')
      .map((s) => [s.family, idfWeights(normalized.map((e) => e.features[s.family] ?? []))]),
  );

  const edges: SimilarityEdge[] = [];
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i]!;
      const b = normalized[j]!;
      const components: EdgeComponent[] = signals.map((s) => {
        const fa = a.features[s.family] ?? [];
        const fb = b.features[s.family] ?? [];
        const r = s.method === 'idf' ? idfCosine(fa, fb, idf.get(s.family)!) : jaccard(fa, fb);
        return { family: s.family, score: r.score, evidence: r.evidence };
      });
      const score = signals.reduce((acc, s, k) => acc + s.weight * components[k]!.score, 0);
      edges.push({ source: a.id, target: b.id, score, components });
    }
  }
  return edges;
}
