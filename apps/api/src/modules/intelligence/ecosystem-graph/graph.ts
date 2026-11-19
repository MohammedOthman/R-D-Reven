import type {
  EcosystemGraph,
  FeatureAccount,
  GraphGroup,
  GraphNode,
  SimilarityEdge,
} from './ecosystem-graph.types';
import { CALCULATION_VERSION, SIMILARITY_WEIGHTS } from './ecosystem-graph.types';

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Keep each node's k strongest edges (union) — the sparsification the source method uses. */
export function topKUnion(edges: readonly SimilarityEdge[], k: number): SimilarityEdge[] {
  const byNode = new Map<string, SimilarityEdge[]>();
  for (const edge of edges) {
    for (const node of [edge.source, edge.target]) {
      const list = byNode.get(node) ?? [];
      list.push(edge);
      byNode.set(node, list);
    }
  }
  const keep = new Map<string, SimilarityEdge>();
  for (const list of byNode.values()) {
    [...list]
      .sort(
        (x, y) =>
          y.score - x.score ||
          pairKey(x.source, x.target).localeCompare(pairKey(y.source, y.target)),
      )
      .slice(0, k)
      .forEach((edge) => keep.set(pairKey(edge.source, edge.target), edge));
  }
  return [...keep.values()];
}

/**
 * Greedy modularity optimisation (the local-moving phase of Louvain).
 *
 * Plain label propagation collapses a connected similarity graph into one
 * community, which is useless on this data. Moving each node to the
 * neighbouring community with the best modularity gain keeps genuine
 * clusters (payments vs. commerce vs. government) separate. Deterministic:
 * nodes are visited in sorted order and ties keep the current community.
 */
export function communities(
  nodeIds: readonly string[],
  edges: readonly SimilarityEdge[],
  maxIterations = 50,
): Map<string, number> {
  const order = [...nodeIds].sort();
  if (order.length === 0) return new Map();

  const adjacency = new Map<string, Map<string, number>>(
    order.map((id) => [id, new Map<string, number>()]),
  );
  let totalWeight = 0;
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    const weight = Math.max(0, edge.score);
    if (weight === 0) continue;
    const from = adjacency.get(edge.source)!;
    const to = adjacency.get(edge.target)!;
    from.set(edge.target, (from.get(edge.target) ?? 0) + weight);
    to.set(edge.source, (to.get(edge.source) ?? 0) + weight);
    totalWeight += weight;
  }
  const m = totalWeight || 1;

  const degree = new Map(
    order.map((id) => [
      id,
      [...(adjacency.get(id)?.values() ?? [])].reduce((sum, weight) => sum + weight, 0),
    ]),
  );
  const community = new Map(order.map((id) => [id, id]));
  const totals = new Map(order.map((id) => [id, degree.get(id) ?? 0]));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let improved = false;
    for (const id of order) {
      const current = community.get(id)!;
      const strength = degree.get(id) ?? 0;
      if (strength === 0) continue;

      const weights = new Map<string, number>();
      for (const [neighbour, weight] of adjacency.get(id) ?? []) {
        const target = community.get(neighbour)!;
        weights.set(target, (weights.get(target) ?? 0) + weight);
      }

      totals.set(current, (totals.get(current) ?? 0) - strength);
      let best = current;
      let bestGain =
        (weights.get(current) ?? 0) - (strength * (totals.get(current) ?? 0)) / (2 * m);
      for (const [candidate, weight] of weights) {
        const gain = weight - (strength * (totals.get(candidate) ?? 0)) / (2 * m);
        if (gain > bestGain + 1e-12) {
          bestGain = gain;
          best = candidate;
        }
      }
      totals.set(best, (totals.get(best) ?? 0) + strength);
      if (best !== current) {
        community.set(id, best);
        improved = true;
      }
    }
    if (!improved) break;
  }

  const ids = new Map<string, number>();
  const result = new Map<string, number>();
  for (const id of order) {
    const label = community.get(id)!;
    if (!ids.has(label)) ids.set(label, ids.size);
    result.set(id, ids.get(label)!);
  }
  return result;
}

/** Weighted PageRank on the undirected similarity graph, normalised to sum 1. */
export function pageRank(
  nodeIds: readonly string[],
  edges: readonly SimilarityEdge[],
  damping = 0.85,
  iterations = 60,
): Map<string, number> {
  const n = nodeIds.length;
  if (n === 0) return new Map();
  const index = new Map(nodeIds.map((id, i) => [id, i]));
  const strength = new Array<number>(n).fill(0);
  for (const edge of edges) {
    const source = index.get(edge.source);
    const target = index.get(edge.target);
    if (source === undefined || target === undefined) continue;
    strength[source] = (strength[source] ?? 0) + edge.score;
    strength[target] = (strength[target] ?? 0) + edge.score;
  }
  let rank = new Array<number>(n).fill(1 / n);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next = new Array<number>(n).fill((1 - damping) / n);
    let dangling = 0;
    for (let i = 0; i < n; i++) {
      if (strength[i] === 0) dangling += rank[i]!;
    }
    for (let i = 0; i < n; i++) {
      if (strength[i] === 0) continue;
      next[i]! += (damping * dangling) / n;
    }
    for (const edge of edges) {
      const source = index.get(edge.source)!;
      const target = index.get(edge.target)!;
      if ((strength[source] ?? 0) > 0) {
        next[target]! += (damping * rank[source]! * edge.score) / strength[source]!;
      }
      if ((strength[target] ?? 0) > 0) {
        next[source]! += (damping * rank[target]! * edge.score) / strength[target]!;
      }
    }
    rank = next;
  }
  const total = rank.reduce((sum, value) => sum + value, 0) || 1;
  return new Map(nodeIds.map((id, i) => [id, rank[i]! / total]));
}

const WIDTH = 1000;
const HEIGHT = 680;
const PADDING = 70;

/**
 * Deterministic grouped layout. Accounts in the same group sit in the same
 * sector; a short spring/repulsion pass separates overlapping nodes. The
 * result is stable across requests, which keeps the map from jumping.
 */
export function layout(
  nodeIds: readonly string[],
  edges: readonly SimilarityEdge[],
  groups: Map<string, number>,
): Map<string, { x: number; y: number }> {
  const ids = [...nodeIds].sort();
  const n = ids.length;
  if (n === 0) return new Map();
  const groupIds = [...new Set(ids.map((id) => groups.get(id) ?? 0))].sort((a, b) => a - b);
  const groupCount = Math.max(1, groupIds.length);
  const positions = new Map<string, { x: number; y: number }>();

  // Seed: one sector per group, members spread on an inner ring.
  groupIds.forEach((groupId, groupIndex) => {
    const members = ids.filter((id) => (groups.get(id) ?? 0) === groupId);
    const sectorStart = (groupIndex / groupCount) * Math.PI * 2 - Math.PI / 2;
    members.forEach((id, memberIndex) => {
      const angle = sectorStart + (memberIndex / Math.max(1, members.length)) * 0.9;
      const radius = members.length === 1 ? 0.42 : 0.48;
      positions.set(id, {
        x: WIDTH / 2 + Math.cos(angle) * WIDTH * radius * 0.42,
        y: HEIGHT / 2 + Math.sin(angle) * HEIGHT * radius * 0.42,
      });
    });
  });

  if (n > 1) {
    const area = (WIDTH - PADDING * 2) * (HEIGHT - PADDING * 2);
    const k = Math.sqrt(area / n);
    const iterations = n <= 120 ? 120 : n <= 300 ? 60 : 30;
    for (let iteration = 0; iteration < iterations; iteration++) {
      const temperature = (WIDTH / 12) * (1 - iteration / iterations) + 1;
      const displacement = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = positions.get(ids[i]!)!;
          const b = positions.get(ids[j]!)!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let distance = Math.hypot(dx, dy);
          if (distance < 0.01) {
            dx = (i - j) * 0.1 || 0.1;
            dy = (j - i) * 0.1 || 0.1;
            distance = Math.hypot(dx, dy);
          }
          const force = (k * k) / distance;
          const ux = dx / distance;
          const uy = dy / distance;
          const da = displacement.get(ids[i]!)!;
          const db = displacement.get(ids[j]!)!;
          da.x += ux * force;
          da.y += uy * force;
          db.x -= ux * force;
          db.y -= uy * force;
        }
      }
      for (const edge of edges) {
        const a = positions.get(edge.source);
        const b = positions.get(edge.target);
        if (!a || !b) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.max(0.01, Math.hypot(dx, dy));
        const force = (distance * distance) / k;
        const ux = dx / distance;
        const uy = dy / distance;
        const da = displacement.get(edge.source)!;
        const db = displacement.get(edge.target)!;
        da.x -= ux * force * edge.score;
        da.y -= uy * force * edge.score;
        db.x += ux * force * edge.score;
        db.y += uy * force * edge.score;
      }
      for (const id of ids) {
        const point = positions.get(id)!;
        const delta = displacement.get(id)!;
        const dx = WIDTH / 2 - point.x;
        const dy = HEIGHT / 2 - point.y;
        const length = Math.max(0.01, Math.hypot(dx, dy));
        delta.x += (dx / length) * k * 0.08;
        delta.y += (dy / length) * k * 0.08;
        const magnitude = Math.max(0.01, Math.hypot(delta.x, delta.y));
        const step = Math.min(magnitude, temperature);
        point.x = Math.min(
          WIDTH - PADDING,
          Math.max(PADDING, point.x + (delta.x / magnitude) * step),
        );
        point.y = Math.min(
          HEIGHT - PADDING,
          Math.max(PADDING, point.y + (delta.y / magnitude) * step),
        );
      }
    }
  }

  const minX = Math.min(...[...positions.values()].map((p) => p.x));
  const maxX = Math.max(...[...positions.values()].map((p) => p.x));
  const minY = Math.min(...[...positions.values()].map((p) => p.y));
  const maxY = Math.max(...[...positions.values()].map((p) => p.y));
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  for (const point of positions.values()) {
    point.x = spanX < 1 ? WIDTH / 2 : PADDING + ((point.x - minX) / spanX) * (WIDTH - PADDING * 2);
    point.y =
      spanY < 1 ? HEIGHT / 2 : PADDING + ((point.y - minY) / spanY) * (HEIGHT - PADDING * 2);
  }
  return positions;
}

const TERM_DISPLAY: Record<string, string> = {
  ai: 'AI',
  saas: 'SaaS',
  pos: 'POS',
  qa: 'QA',
  sme: 'SME',
  api: 'API',
  crm: 'CRM',
  erp: 'ERP',
  pif: 'PIF',
};

function displayTerm(term: string): string {
  return TERM_DISPLAY[term] ?? term.charAt(0).toUpperCase() + term.slice(1);
}

function sharedTerms(members: readonly FeatureAccount[], family: 'keywords' | 'technologies') {
  const counts = new Map<string, number>();
  for (const member of members) {
    for (const term of new Set(member[family])) {
      const normalized = term.trim().toLowerCase();
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term);
}

function groupLabels(
  accounts: readonly FeatureAccount[],
  groups: Map<string, number>,
): GraphGroup[] {
  const byGroup = new Map<number, FeatureAccount[]>();
  for (const account of accounts) {
    const group = groups.get(account.id) ?? 0;
    const list = byGroup.get(group) ?? [];
    list.push(account);
    byGroup.set(group, list);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, members]) => {
      // Topics read better than tool names ("Government · Cloud" rather than
      // "cisco webex control hub"). Fall back to tools when a group has too
      // few shared topics to name itself.
      const keywordTerms = sharedTerms(members, 'keywords');
      const topTerms = (
        keywordTerms.length >= 2 ? keywordTerms : sharedTerms(members, 'technologies')
      ).slice(0, 3);
      return {
        id,
        label: topTerms.length ? topTerms.map(displayTerm).join(' · ') : `Group ${id + 1}`,
        members: members.length,
        topTerms,
      };
    });
}

export function buildGraph(
  accounts: readonly FeatureAccount[],
  edges: readonly SimilarityEdge[],
  options: { now?: Date; source?: 'stored' | 'computed' } = {},
): EcosystemGraph {
  const nodeIds = accounts.map((account) => account.id);
  const groups = communities(nodeIds, edges);
  const rank = pageRank(nodeIds, edges);
  const positions = layout(nodeIds, edges, groups);
  const labels = new Map(groupLabels(accounts, groups).map((group) => [group.id, group.label]));

  const nodes: GraphNode[] = accounts
    .map((account) => ({
      id: account.id,
      name: account.name,
      group: groups.get(account.id) ?? 0,
      headcount: account.headcount ?? null,
      hqCity: account.hqCity ?? null,
      hqCountry: account.hqCountry ?? null,
      centrality: rank.get(account.id) ?? 0,
      x: positions.get(account.id)?.x ?? WIDTH / 2,
      y: positions.get(account.id)?.y ?? HEIGHT / 2,
    }))
    .sort((a, b) => b.centrality - a.centrality || a.name.localeCompare(b.name));

  return {
    nodes,
    edges: [...edges],
    groups: groupLabels(accounts, groups).map((group) => ({
      ...group,
      label: labels.get(group.id) ?? group.label,
    })),
    provenance: {
      calculationVersion: CALCULATION_VERSION,
      refreshedAt: (options.now ?? new Date()).toISOString(),
      weights: { ...SIMILARITY_WEIGHTS },
      source: options.source ?? 'computed',
    },
  };
}
