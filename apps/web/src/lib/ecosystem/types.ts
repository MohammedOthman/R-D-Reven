export type FeatureFamily = 'technologies' | 'keywords' | 'industries' | 'lists';

export interface GraphEdgeComponent {
  family: FeatureFamily;
  score: number;
  evidence: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  score: number;
  components: GraphEdgeComponent[];
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

export interface EcosystemGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  provenance: {
    calculationVersion: string;
    refreshedAt: string;
    weights: Record<string, number>;
    source: 'stored' | 'computed';
  };
}

export interface EcosystemNeighbour {
  id: string;
  name: string;
  headcount: number | null;
  score: number;
  components: GraphEdgeComponent[];
}

export interface EcosystemPartner {
  partnerId: string;
  name: string;
  relationship: string | null;
  stage: string | null;
  health: string | null;
}

export interface EcosystemAccountDetail {
  account: {
    id: string;
    name: string;
    domains: string[];
    headcount: number | null;
    hqCity: string | null;
    hqCountry: string | null;
    parentName: string | null;
    revenue: string | null;
    technologies: string[];
    keywords: string[];
    industryCodes: string[];
    lists: string[];
    source: string;
    status: string;
    updatedAt: string;
  };
  group: GraphGroup | null;
  centrality: number;
  neighbours: EcosystemNeighbour[];
  partners: EcosystemPartner[];
  missing: {
    technologies: boolean;
    keywords: boolean;
    industries: boolean;
  };
}
