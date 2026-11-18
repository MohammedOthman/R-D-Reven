import { scorePairs } from './coupling';
import type {
  EntityFeatures,
  SignalWeight,
  SimilarityEdge,
  SimilarityGraph,
} from './ecosystem-graph.types';

export const CALCULATION_VERSION = 'ecosystem-graph/0.1.0';

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Keep each node's k strongest edges (union), the sparsification Connected Papers-style layouts rely on. */
export function topKUnion(edges: readonly SimilarityEdge[], k: number): SimilarityEdge[] {
  const byNode = new Map<string, SimilarityEdge[]>();
  for (const e of edges) {
    for (const n of [e.source, e.target]) {
      const list = byNode.get(n) ?? [];
      list.push(e);
      byNode.set(n, list);
    }
  }
  const keep = new Map<string, SimilarityEdge>();
  for (const list of byNode.values()) {
    [...list]
      .sort(
        (x, y) =>
          y.score - x.score || key(x.source, x.target).localeCompare(key(y.source, y.target)),
      )
      .slice(0, k)
      .forEach((e) => keep.set(key(e.source, e.target), e));
  }
  return [...keep.values()];
}

/**
 * Deterministic weighted label propagation. Smaller and dependency-free
 * compared with Louvain/Leiden; adequate for tenant-sized graphs (tens to
 * low thousands of nodes). Swap for Leiden when a graph store exists.
 */
export function communities(
  nodeIds: readonly string[],
  edges: readonly SimilarityEdge[],
  maxIter = 50,
): Map<string, number> {
  const adj = new Map<string, { n: string; w: number }[]>(nodeIds.map((id) => [id, []]));
  for (const e of edges) {
    adj.get(e.source)?.push({ n: e.target, w: e.score });
    adj.get(e.target)?.push({ n: e.source, w: e.score });
  }
  const label = new Map(nodeIds.map((id) => [id, id]));
  const order = [...nodeIds].sort();
  for (let it = 0; it < maxIter; it++) {
    let changed = false;
    for (const id of order) {
      const votes = new Map<string, number>();
      for (const { n, w } of adj.get(id) ?? []) {
        const l = label.get(n)!;
        votes.set(l, (votes.get(l) ?? 0) + w);
      }
      if (votes.size === 0) continue;
      const best = [...votes.entries()].sort(
        (x, y) => y[1] - x[1] || x[0].localeCompare(y[0]),
      )[0]![0];
      if (best !== label.get(id)) {
        label.set(id, best);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const ids = new Map<string, number>();
  const out = new Map<string, number>();
  for (const id of order) {
    const l = label.get(id)!;
    if (!ids.has(l)) ids.set(l, ids.size);
    out.set(id, ids.get(l)!);
  }
  return out;
}

/** Dijkstra with cost 1 − score: the "path back to the origin" a Connected Papers graph highlights. */
export function pathToOrigin(
  origin: string,
  edges: readonly SimilarityEdge[],
): Map<string, string> {
  const nodes = new Set<string>([origin]);
  edges.forEach((e) => {
    nodes.add(e.source);
    nodes.add(e.target);
  });
  const dist = new Map([...nodes].map((n) => [n, Number.POSITIVE_INFINITY]));
  const prev = new Map<string, string>();
  dist.set(origin, 0);
  const open = new Set(nodes);
  while (open.size > 0) {
    let u: string | null = null;
    for (const n of open) if (u === null || dist.get(n)! < dist.get(u)!) u = n;
    if (u === null || dist.get(u) === Number.POSITIVE_INFINITY) break;
    open.delete(u);
    for (const e of edges) {
      if (e.source !== u && e.target !== u) continue;
      const v = e.source === u ? e.target : e.source;
      const alt = dist.get(u)! + (1 - e.score);
      if (alt < dist.get(v)!) {
        dist.set(v, alt);
        prev.set(v, u);
      }
    }
  }
  return prev;
}

export function buildSimilarityGraph(
  entities: readonly EntityFeatures[],
  signals: readonly SignalWeight[],
  options: { topK?: number; now?: Date } = {},
): SimilarityGraph {
  const all = scorePairs(entities, signals);
  const edges = topKUnion(all, options.topK ?? 3);
  const comm = communities(
    entities.map((e) => e.id),
    edges,
  );
  return {
    nodes: entities.map((e) => ({ id: e.id, label: e.label, community: comm.get(e.id) ?? 0 })),
    edges,
    provenance: {
      calculationVersion: CALCULATION_VERSION,
      refreshedAt: (options.now ?? new Date()).toISOString(),
      inputs: signals.map((s) => `${s.family}:${s.method}:${s.weight}`),
    },
  };
}
