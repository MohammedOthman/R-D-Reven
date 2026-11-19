import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@revn/db';
import { recordAuditEvent } from '../../audit-operations/audit.service';
import { scoreAccounts } from './coupling';
import { EXAMPLE_ACCOUNTS, EXAMPLE_EDGES } from './example-data';
import { buildGraph, topKUnion } from './graph';
import type {
  EcosystemGraph,
  EdgeComponent,
  FeatureAccount,
  SimilarityEdge,
} from './ecosystem-graph.types';
import { CALCULATION_VERSION, SIMILARITY_WEIGHTS } from './ecosystem-graph.types';

const EXAMPLE_CALCULATION_VERSION = 'seed/account-graph/2026-11';
const EXAMPLE_SOURCE = 'SEED';

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type AccountRow = {
  id: string;
  name: string;
  technologies: string[];
  keywords: string[];
  industryCodes: string[];
  lists: string[];
  headcount: number | null;
  hqCity: string | null;
  hqCountry: string | null;
  parentName: string | null;
  source: string;
  status: string;
  updatedAt: Date;
};

function toFeatureAccount(account: AccountRow): FeatureAccount {
  return {
    id: account.id,
    name: account.name,
    technologies: account.technologies,
    keywords: account.keywords,
    industryCodes: account.industryCodes,
    lists: account.lists,
    headcount: account.headcount,
    hqCity: account.hqCity,
    hqCountry: account.hqCountry,
  };
}

function toComponents(value: unknown): EdgeComponent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const family = record.family;
    if (
      family !== 'technologies' &&
      family !== 'keywords' &&
      family !== 'industries' &&
      family !== 'lists'
    ) {
      return [];
    }
    return [
      {
        family: family as EdgeComponent['family'],
        score: typeof record.score === 'number' ? record.score : 0,
        evidence: Array.isArray(record.evidence)
          ? record.evidence.filter((item): item is string => typeof item === 'string')
          : [],
      },
    ];
  });
}

@Injectable()
export class EcosystemGraphService {
  async getGraph(tenantId: string): Promise<EcosystemGraph> {
    const [accounts, storedEdges] = await Promise.all([
      prisma.account.findMany({
        where: { tenantId, status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      }),
      prisma.accountSimilarityEdge.findMany({ where: { tenantId } }),
    ]);

    const features = (accounts as AccountRow[]).map(toFeatureAccount);
    const activeIds = new Set(features.map((account) => account.id));
    const edges: SimilarityEdge[] = storedEdges
      .filter(
        (edge) =>
          activeIds.has(edge.sourceAccountId) && activeIds.has(edge.targetAccountId),
      )
      .map((edge) => ({
        source: edge.sourceAccountId,
        target: edge.targetAccountId,
        score: edge.score,
        components: toComponents(edge.components),
      }));

    if (features.length === 0) {
      return buildGraph([], [], { source: 'computed' });
    }

    if (edges.length === 0) {
      const computed = topKUnion(scoreAccounts(features), 3);
      const graph = buildGraph(features, computed, { source: 'computed' });
      return this.withWeights(graph);
    }

    // A newly added account has no stored edges yet. Compute its strongest
    // pairs on read so it never appears isolated just because the stored
    // graph was built before it existed. Stored edges win on duplicates.
    const connected = new Set<string>();
    for (const edge of edges) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
    const isolated = new Set(
      features.filter((account) => !connected.has(account.id)).map((account) => account.id),
    );
    if (isolated.size > 0) {
      const seen = new Set(edges.map((edge) => edgeKey(edge.source, edge.target)));
      for (const edge of topKUnion(scoreAccounts(features), 3)) {
        if (!isolated.has(edge.source) && !isolated.has(edge.target)) continue;
        const key = edgeKey(edge.source, edge.target);
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push(edge);
      }
    }

    return this.withWeights(buildGraph(features, edges, { source: 'stored' }));
  }

  async getAccount(tenantId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: { tenantId, id: accountId, status: 'ACTIVE' },
      include: {
        partnerLinks: {
          include: {
            partner: { include: { partnership: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!account) throw new NotFoundException('Account not found.');

    const graph = await this.getGraph(tenantId);
    const node = graph.nodes.find((item) => item.id === accountId) ?? null;
    const group = node ? (graph.groups.find((item) => item.id === node.group) ?? null) : null;
    const accounts = new Map(
      (
        await prisma.account.findMany({
          where: { tenantId, status: 'ACTIVE' },
          select: { id: true, name: true, headcount: true },
        })
      ).map((row) => [row.id, row]),
    );

    const neighbours = graph.edges
      .filter((edge) => edge.source === accountId || edge.target === accountId)
      .map((edge) => {
        const otherId = edge.source === accountId ? edge.target : edge.source;
        return {
          id: otherId,
          name: accounts.get(otherId)?.name ?? 'Unknown account',
          headcount: accounts.get(otherId)?.headcount ?? null,
          score: edge.score,
          components: edge.components,
        };
      })
      .sort((a, b) => b.score - a.score);

    const partners = account.partnerLinks.map((link) => ({
      partnerId: link.partnerId,
      name: link.partner.displayName,
      relationship: link.relationship,
      stage: link.partner.partnership?.stage ?? null,
      health: link.partner.partnership?.health ?? null,
    }));

    return {
      account: {
        id: account.id,
        name: account.name,
        domains: account.domains,
        headcount: account.headcount,
        hqCity: account.hqCity,
        hqCountry: account.hqCountry,
        parentName: account.parentName,
        revenue: account.revenue ? account.revenue.toString() : null,
        technologies: account.technologies,
        keywords: account.keywords,
        industryCodes: account.industryCodes,
        lists: account.lists,
        source: account.source,
        status: account.status,
        updatedAt: account.updatedAt.toISOString(),
      },
      group,
      centrality: node?.centrality ?? 0,
      neighbours,
      partners,
      missing: {
        technologies: account.technologies.length === 0,
        keywords: account.keywords.length === 0,
        industries: account.industryCodes.length === 0,
      },
    };
  }

  /**
   * Pilot-only example data. Idempotent: accounts are matched by name and
   * edges by their canonical pair. Never runs outside pilot/dev.
   */
  async seedExample(tenantId: string, actorId: string) {
    const accountIds = new Map<string, string>();
    const featuresByAccount = new Map<
      string,
      { technologies: Set<string>; keywords: Set<string> }
    >();
    for (const account of EXAMPLE_ACCOUNTS) {
      featuresByAccount.set(account.name, { technologies: new Set(), keywords: new Set() });
    }
    for (const edge of EXAMPLE_EDGES) {
      const a = featuresByAccount.get(edge.a);
      const b = featuresByAccount.get(edge.b);
      for (const tool of edge.tools) {
        a?.technologies.add(tool);
        b?.technologies.add(tool);
      }
      for (const term of edge.terms) {
        a?.keywords.add(term);
        b?.keywords.add(term);
      }
    }

    for (const account of EXAMPLE_ACCOUNTS) {
      const features = featuresByAccount.get(account.name)!;
      const data = {
        name: account.name,
        headcount: account.headcount,
        hqCity: account.hqCity,
        hqCountry: account.hqCountry,
        parentName: account.parentName ?? null,
        technologies: [...features.technologies].sort(),
        keywords: [...features.keywords].sort(),
        industryCodes: [],
        lists: [],
        source: EXAMPLE_SOURCE as 'SEED',
        status: 'ACTIVE' as const,
        updatedById: actorId,
      };
      const existing = await prisma.account.findFirst({
        where: { tenantId, name: account.name },
        select: { id: true },
      });
      if (existing) {
        await prisma.account.update({
          where: { id: existing.id },
          data: { ...data, version: { increment: 1 } },
        });
        accountIds.set(account.name, existing.id);
      } else {
        const created = await prisma.account.create({
          data: { ...data, tenantId, createdById: actorId },
        });
        accountIds.set(account.name, created.id);
      }
    }

    for (const edge of EXAMPLE_EDGES) {
      const sourceId = accountIds.get(edge.a);
      const targetId = accountIds.get(edge.b);
      if (!sourceId || !targetId) continue;
      const [sourceAccountId, targetAccountId] =
        sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
      const components: EdgeComponent[] = [
        { family: 'technologies', score: edge.technologies, evidence: edge.tools },
        { family: 'keywords', score: edge.keywords, evidence: edge.terms },
        { family: 'industries', score: edge.industries, evidence: [] },
        { family: 'lists', score: edge.lists, evidence: [] },
      ];
      await prisma.accountSimilarityEdge.upsert({
        where: {
          tenantId_sourceAccountId_targetAccountId: {
            tenantId,
            sourceAccountId,
            targetAccountId,
          },
        },
        update: {
          score: edge.score,
          components: components as unknown as Prisma.InputJsonValue,
          calculationVersion: EXAMPLE_CALCULATION_VERSION,
          refreshedAt: new Date(),
        },
        create: {
          tenantId,
          sourceAccountId,
          targetAccountId,
          score: edge.score,
          components: components as unknown as Prisma.InputJsonValue,
          calculationVersion: EXAMPLE_CALCULATION_VERSION,
        },
      });
    }

    await recordAuditEvent(tenantId, {
      actorId,
      action: 'ecosystem_example_seeded',
      objectType: 'Account',
      objectId: tenantId,
      after: {
        accounts: EXAMPLE_ACCOUNTS.length,
        edges: EXAMPLE_EDGES.length,
        calculationVersion: EXAMPLE_CALCULATION_VERSION,
      },
    });

    return { accounts: EXAMPLE_ACCOUNTS.length, edges: EXAMPLE_EDGES.length };
  }

  /** Recompute every edge from account features. Owner/Admin only. */
  async rebuild(tenantId: string, actorId: string) {
    const accounts = (await prisma.account.findMany({
      where: { tenantId, status: 'ACTIVE' },
    })) as AccountRow[];
    const features = accounts.map(toFeatureAccount);
    const edges = topKUnion(scoreAccounts(features), 3);
    const nameById = new Map(accounts.map((account) => [account.id, account.name]));

    await prisma.$transaction([
      prisma.accountSimilarityEdge.deleteMany({ where: { tenantId } }),
      prisma.accountSimilarityEdge.createMany({
        data: edges.flatMap((edge) => {
          if (!nameById.has(edge.source) || !nameById.has(edge.target)) return [];
          const [sourceAccountId, targetAccountId] =
            edge.source < edge.target ? [edge.source, edge.target] : [edge.target, edge.source];
          return [
            {
              tenantId,
              sourceAccountId,
              targetAccountId,
              score: edge.score,
              components: edge.components as unknown as Prisma.InputJsonValue,
              calculationVersion: CALCULATION_VERSION,
            },
          ];
        }),
      }),
    ]);

    await recordAuditEvent(tenantId, {
      actorId,
      action: 'ecosystem_graph_rebuilt',
      objectType: 'AccountSimilarityEdge',
      objectId: tenantId,
      after: { accounts: accounts.length, edges: edges.length },
    });

    return { accounts: accounts.length, edges: edges.length };
  }

  private withWeights(graph: EcosystemGraph): EcosystemGraph {
    return {
      ...graph,
      provenance: { ...graph.provenance, weights: { ...SIMILARITY_WEIGHTS } },
    };
  }
}
