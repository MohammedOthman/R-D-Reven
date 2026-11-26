import type { FeatureFamily, GraphNode } from '@/src/lib/ecosystem/types';

export interface GroupTone {
  fill: string;
  dot: string;
  ring: string;
  territory: string;
}

/**
 * Brand-compliant single-hue group palette (docs/brand/BRAND_SYSTEM.md).
 * Accent Blue (#2C5BFF) and its pale tints (#8DA4FF, #AEC5FF) plus neutral
 * navy/slate tones — never a second saturated hue.
 */
export const GROUP_PALETTE: readonly GroupTone[] = [
  { fill: '#2C5BFF', dot: '#2C5BFF', ring: '#8DA4FF', territory: '#2C5BFF' },
  { fill: '#5B7EFF', dot: '#1E47E0', ring: '#AEC5FF', territory: '#8DA4FF' },
  { fill: '#8DA4FF', dot: '#5B7EFF', ring: '#AEC5FF', territory: '#AEC5FF' },
  { fill: '#64748B', dot: '#475569', ring: '#94A3B8', territory: '#64748B' },
  { fill: '#94A3B8', dot: '#6B7180', ring: '#CBD5E1', territory: '#94A3B8' },
  { fill: '#334155', dot: '#0F1629', ring: '#64748B', territory: '#475569' },
];

/** Neutral slate tone for companies with no known group, so they never read as group 0. */
export const NEUTRAL_TONE: GroupTone = {
  fill: '#6B7180',
  dot: '#6B7180',
  ring: '#94A3B8',
  territory: '#94A3B8',
};

export function groupTone(groupId: number): GroupTone {
  const index = Math.abs(groupId) % GROUP_PALETTE.length;
  return GROUP_PALETTE[index] ?? GROUP_PALETTE[0]!;
}

/**
 * Derive a crisp 2-letter monogram for a company name (Latin or Arabic).
 */
export function companyMonogram(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '??';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = [...words[0]!][0] ?? '';
    const second = [...words[1]!][0] ?? '';
    return `${first}${second}`.toUpperCase();
  }
  const chars = [...cleaned];
  return chars.slice(0, 2).join('').toUpperCase();
}

/**
 * Compute the set of top-quartile centrality hubs ("Key hubs").
 */
export function computeHubIds(nodes: readonly GraphNode[]): Set<string> {
  if (nodes.length <= 1) return new Set();
  const sorted = [...nodes].sort((a, b) => a.centrality - b.centrality);
  const threshold = sorted[Math.floor(sorted.length * 0.75)]!.centrality;
  const hubs = new Set<string>();
  for (const node of nodes) {
    if (node.centrality >= threshold && node.centrality > 0) {
      hubs.add(node.id);
    }
  }
  return hubs;
}

export const FEATURE_FAMILIES: readonly FeatureFamily[] = [
  'technologies',
  'keywords',
  'industries',
  'lists',
];
