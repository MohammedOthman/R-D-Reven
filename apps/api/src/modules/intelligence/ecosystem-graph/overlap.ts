import { createHmac } from 'node:crypto';
import type { OverlapCell, Population } from './ecosystem-graph.types';

/**
 * Normalize a company domain to its match key: lowercase, no scheme, no
 * "www.", no path. "https://www.Geidea.net/en" → "geidea.net".
 */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]!
    .replace(/\.$/, '');
}

/**
 * Keyed hash of a domain. Both partners hash with a key agreed under a
 * Share Grant, so the comparison runs on tokens, not on clear domains.
 * This is a pseudonymization step, not a full private-set-intersection
 * protocol: whoever holds the key can test guesses. Production overlap
 * should run inside the platform (neither side sees the other's list) or
 * through a real PSI library.
 */
export function blindToken(domain: string, sharedKey: string): string {
  return createHmac('sha256', sharedKey).update(normalizeDomain(domain)).digest('hex');
}

/**
 * Account-mapping matrix: overlap counts for every (own population ×
 * partner population) pair, the grid Crossbeam popularized. Counts below
 * `minCount` are suppressed to null so a small cell cannot single out an
 * account.
 */
export function overlapMatrix(
  own: readonly Population[],
  partner: readonly Population[],
  sharedKey: string,
  minCount = 3,
): OverlapCell[] {
  const tokens = (p: Population) => new Set(p.domains.map((d) => blindToken(d, sharedKey)));
  const ownT = own.map((p) => ({ name: p.name, t: tokens(p) }));
  const partT = partner.map((p) => ({ name: p.name, t: tokens(p) }));
  const cells: OverlapCell[] = [];
  for (const o of ownT) {
    for (const p of partT) {
      let n = 0;
      for (const x of o.t) if (p.t.has(x)) n++;
      cells.push({
        ownPopulation: o.name,
        partnerPopulation: p.name,
        count: n >= minCount ? n : null,
      });
    }
  }
  return cells;
}
