/**
 * Ecosystem graph read model — types.
 *
 * Research spike (docs/ecosystem-graph/ECOSYSTEM_GRAPH.md). Pure functions,
 * no tables, no controller, not registered in any Nest module. The shared
 * partnership graph is "Later" (proof-gated, PRD §18 / ROADMAP "Later");
 * this code exists so the scoring math is reviewable and tested before any
 * product decision is made about where it runs.
 */

/** Every derived artefact carries provenance (PRD §4.1, last bullet). */
export interface Provenance {
  calculationVersion: string;
  refreshedAt: string;
  inputs: string[];
}

/** One node with the sets it "cites": tools, topics, industry codes, owners, lists. */
export interface EntityFeatures {
  id: string;
  label: string;
  features: Record<string, readonly string[]>;
}

export interface SignalWeight {
  /** Name of a feature family on EntityFeatures.features. */
  family: string;
  weight: number;
  /** idf: rare shared features count more. jaccard: plain overlap. */
  method: 'idf' | 'jaccard';
}

export interface EdgeComponent {
  family: string;
  score: number;
  evidence: string[];
}

export interface SimilarityEdge {
  source: string;
  target: string;
  score: number;
  components: EdgeComponent[];
}

export interface SimilarityGraph {
  nodes: { id: string; label: string; community: number }[];
  edges: SimilarityEdge[];
  provenance: Provenance;
}

/** A Crossbeam-style population: one company's segment of accounts (customers, open opps, prospects). */
export interface Population {
  owner: string;
  name: string;
  /** Normalized account domains. Never leaves the owner's tenant in clear text. */
  domains: readonly string[];
}

export interface OverlapCell {
  ownPopulation: string;
  partnerPopulation: string;
  /** null when suppressed below the k-anonymity floor. */
  count: number | null;
}
