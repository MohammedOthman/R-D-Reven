/**
 * Ecosystem graph read model — types.
 *
 * The graph is derived from `Account` source data: two accounts are close
 * when they share rare tools, topics, industry codes, or a list that does
 * not contain the whole tenant. See docs/ARCHITECTURE.md and
 * docs/DECISIONS.md.
 */

export const SIMILARITY_WEIGHTS = {
  technologies: 0.4,
  keywords: 0.35,
  industries: 0.15,
  lists: 0.1,
} as const;

export const CALCULATION_VERSION = 'ecosystem-graph/1.0.0';

export type FeatureFamily = keyof typeof SIMILARITY_WEIGHTS;

export interface FeatureAccount {
  id: string;
  name: string;
  technologies: readonly string[];
  keywords: readonly string[];
  industryCodes: readonly string[];
  lists: readonly string[];
  headcount?: number | null;
  hqCity?: string | null;
  hqCountry?: string | null;
}

export interface EdgeComponent {
  family: FeatureFamily;
  score: number;
  evidence: string[];
}

export interface SimilarityEdge {
  source: string;
  target: string;
  score: number;
  components: EdgeComponent[];
}

export interface GraphNode {
  id: string;
  name: string;
  group: number;
  headcount: number | null;
  hqCity: string | null;
  hqCountry: string | null;
  centrality: number;
  x: number;
  y: number;
}

export interface GraphGroup {
  id: number;
  label: string;
  members: number;
  topTerms: string[];
}

export interface GraphProvenance {
  calculationVersion: string;
  refreshedAt: string;
  weights: Record<string, number>;
  source: 'stored' | 'computed';
}

export interface EcosystemGraph {
  nodes: GraphNode[];
  edges: SimilarityEdge[];
  groups: GraphGroup[];
  provenance: GraphProvenance;
}
