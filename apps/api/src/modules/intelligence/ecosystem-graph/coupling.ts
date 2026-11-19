import type { EdgeComponent, FeatureAccount, SimilarityEdge } from './ecosystem-graph.types';
import { SIMILARITY_WEIGHTS } from './ecosystem-graph.types';

/** Lowercase, trim, and dedupe a feature list — imports repeat entries within one row. */
export function normalizeFeatures(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim().toLowerCase()).filter((v) => v.length > 0))];
}

/** ln(N / df) per feature. A feature every account has scores 0 and adds no signal. */
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
  evidenceLimit = 6,
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
 * Co-listing is the account graph's "co-citation" signal: a third party put
 * both accounts on the same list. A list that contains every account carries
 * no information, so it is not counted (the same rule the source analysis
 * used). Binary, matching the documented method.
 */
export function coListing(
  a: readonly string[],
  b: readonly string[],
  listDocumentFrequency: Map<string, number>,
  accountCount: number,
): { score: number; evidence: string[] } {
  const shared = [...new Set(a)].filter((list) => b.includes(list));
  const meaningful = shared
    .filter((list) => (listDocumentFrequency.get(list) ?? 0) < accountCount)
    .sort();
  return { score: meaningful.length > 0 ? 1 : 0, evidence: meaningful };
}

/** Build every scored pair. Sparsification is a separate step (`topKUnion`). */
export function scoreAccounts(accounts: readonly FeatureAccount[]): SimilarityEdge[] {
  const normalized = accounts.map((account) => ({
    id: account.id,
    technologies: normalizeFeatures(account.technologies),
    keywords: normalizeFeatures(account.keywords),
    industries: normalizeFeatures(account.industryCodes),
    lists: normalizeFeatures(account.lists),
  }));

  const technologyWeights = idfWeights(normalized.map((a) => a.technologies));
  const keywordWeights = idfWeights(normalized.map((a) => a.keywords));
  const listDf = new Map<string, number>();
  for (const account of normalized) {
    for (const list of new Set(account.lists)) listDf.set(list, (listDf.get(list) ?? 0) + 1);
  }

  const edges: SimilarityEdge[] = [];
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i]!;
      const b = normalized[j]!;
      const technologies = idfCosine(a.technologies, b.technologies, technologyWeights);
      const keywords = idfCosine(a.keywords, b.keywords, keywordWeights);
      const industries = jaccard(a.industries, b.industries);
      const lists = coListing(a.lists, b.lists, listDf, normalized.length);
      const components: EdgeComponent[] = [
        { family: 'technologies', score: technologies.score, evidence: technologies.evidence },
        { family: 'keywords', score: keywords.score, evidence: keywords.evidence },
        { family: 'industries', score: industries.score, evidence: industries.evidence },
        { family: 'lists', score: lists.score, evidence: lists.evidence },
      ];
      const score = components.reduce(
        (sum, component) => sum + SIMILARITY_WEIGHTS[component.family] * component.score,
        0,
      );
      edges.push({ source: a.id, target: b.id, score, components });
    }
  }
  return edges;
}
