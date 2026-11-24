'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  Clock,
  Crosshair,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  SearchInput,
  Textarea,
  useToast,
} from '@revn/ui';
import { Link, useRouter } from '@/src/i18n/navigation';
import { ApiError } from '@/src/lib/api/error';
import {
  createAccount,
  rebuildEcosystemGraph,
  seedEcosystemExample,
} from '@/src/lib/ecosystem/client';
import type { EcosystemGraph, FeatureFamily, GraphNode } from '@/src/lib/ecosystem/types';
import type { MembershipRole } from '@/src/lib/tenant/types';
import { EcosystemGraphCanvas } from '@/src/components/ecosystem/EcosystemGraphCanvas';
import {
  FEATURE_FAMILIES,
  companyMonogram,
  computeHubIds,
  groupTone,
} from '@/src/components/ecosystem/ecosystem-visuals';
import './ecosystem.css';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const ADMIN_ROLES: MembershipRole[] = ['OWNER', 'ADMIN'];

type Neighbour = {
  node: GraphNode;
  score: number;
  components: EcosystemGraph['edges'][number]['components'];
};

function splitList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function familyLabelKey(family: FeatureFamily): 'tools' | 'topics' | 'industry' | 'lists' {
  switch (family) {
    case 'technologies':
      return 'tools';
    case 'keywords':
      return 'topics';
    case 'industries':
      return 'industry';
    case 'lists':
      return 'lists';
  }
}

export function EcosystemContent({
  tenantId,
  graph,
  pilotMode,
  currentRole,
}: {
  tenantId: string;
  graph: EcosystemGraph;
  pilotMode: boolean;
  currentRole: MembershipRole;
}) {
  const t = useTranslations('ecosystem');
  const locale = useLocale();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const router = useRouter();
  const { toast } = useToast();

  const canWrite = WRITE_ROLES.includes(currentRole);
  const canAdmin = ADMIN_ROLES.includes(currentRole);
  const canSeed = pilotMode && canAdmin;

  const [selectedId, setSelectedId] = useState<string | null>(graph.nodes[0]?.id ?? null);
  const [comparedId, setComparedId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | null>(null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<number | 'all'>('all');
  const [seeding, setSeeding] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const groupById = useMemo(
    () => new Map(graph.groups.map((entry) => [entry.id, entry])),
    [graph.groups],
  );
  const hubIds = useMemo(() => computeHubIds(graph.nodes), [graph.nodes]);

  const neighboursByNode = useMemo(() => {
    const map = new Map<string, Neighbour[]>();
    for (const edge of graph.edges) {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) continue;
      const sourceList = map.get(edge.source) ?? [];
      sourceList.push({ node: target, score: edge.score, components: edge.components });
      map.set(edge.source, sourceList);
      const targetList = map.get(edge.target) ?? [];
      targetList.push({ node: source, score: edge.score, components: edge.components });
      map.set(edge.target, targetList);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name));
    }
    return map;
  }, [graph.edges, nodeById]);

  // Selection fallback: auto-select first company if workspace was previously empty or selection disappeared
  const effectiveSelectedId = useMemo(() => {
    if (selectedId && nodeById.has(selectedId)) return selectedId;
    return graph.nodes[0]?.id ?? null;
  }, [selectedId, nodeById, graph.nodes]);

  // Synced filter across map & directory table: search by company name, city, or group label + group pill
  const normalizedQuery = query.trim().toLowerCase();
  const filteredNodes = useMemo(() => {
    return graph.nodes.filter((node) => {
      if (group !== 'all' && node.group !== group) return false;
      if (!normalizedQuery) return true;
      const groupLabel = groupById.get(node.group)?.label ?? '';
      return (
        node.name.toLowerCase().includes(normalizedQuery) ||
        (node.hqCity?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (node.hqCountry?.toLowerCase().includes(normalizedQuery) ?? false) ||
        groupLabel.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [graph.nodes, group, normalizedQuery, groupById]);

  const filteredIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);

  const filtersActive = normalizedQuery.length > 0 || group !== 'all';

  const selected = effectiveSelectedId ? (nodeById.get(effectiveSelectedId) ?? null) : null;
  const selectedNeighbours = useMemo(
    () => (effectiveSelectedId ? (neighboursByNode.get(effectiveSelectedId) ?? []) : []),
    [effectiveSelectedId, neighboursByNode],
  );

  const comparedNeighbour = useMemo(() => {
    if (selectedNeighbours.length === 0) return null;
    if (comparedId) {
      const explicit = selectedNeighbours.find((item) => item.node.id === comparedId);
      if (explicit) return explicit;
    }
    return selectedNeighbours[0] ?? null;
  }, [selectedNeighbours, comparedId]);

  const selectedGroup = selected ? (groupById.get(selected.group) ?? null) : null;
  const isKeyHub = selected !== null && hubIds.has(selected.id);

  const handleSelectCompany = (id: string) => {
    setSelectedId(id);
    setComparedId(null);
  };

  const handleFocusCompany = (id: string) => {
    setSelectedId(id);
    setComparedId(null);
    setFocusRequest((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  const handleCompareEdge = (sourceId: string, targetId: string) => {
    if (effectiveSelectedId === sourceId) {
      setComparedId(targetId);
    } else if (effectiveSelectedId === targetId) {
      setComparedId(sourceId);
    } else {
      setSelectedId(sourceId);
      setComparedId(targetId);
    }
  };

  const handleResetFilters = () => {
    setQuery('');
    setGroup('all');
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { result } = await seedEcosystemExample(tenantId);
      toast({
        title: t('seedSuccessTitle'),
        description: t('seedSuccessDescription', {
          accounts: result.accounts,
          edges: result.edges,
        }),
      });
      router.refresh();
    } catch {
      toast({
        title: t('seedErrorTitle'),
        description: t('seedErrorDescription'),
        variant: 'error',
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const { result } = await rebuildEcosystemGraph(tenantId);
      toast({
        title: t('refreshSuccessTitle'),
        description: t('refreshSuccessDescription', {
          accounts: result.accounts,
          edges: result.edges,
        }),
      });
      router.refresh();
    } catch {
      toast({
        title: t('refreshErrorTitle'),
        description: t('refreshErrorDescription'),
        variant: 'error',
      });
    } finally {
      setRebuilding(false);
    }
  };

  const updatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        new Date(graph.provenance.refreshedAt),
      ),
    [locale, graph.provenance.refreshedAt],
  );

  const comparedSignals = useMemo(() => {
    if (!comparedNeighbour) return [];
    const byFamily = new Map(comparedNeighbour.components.map((c) => [c.family, c]));
    return FEATURE_FAMILIES.map((family) => byFamily.get(family)).filter(
      (component): component is NonNullable<typeof component> =>
        component !== undefined && (component.score > 0 || component.evidence.length > 0),
    );
  }, [comparedNeighbour]);

  return (
    <div className="eco-page">
      {/* Deep Navy Hero Header */}
      <section className="eco-hero" aria-labelledby="ecosystem-heading">
        <div className="eco-hero-copy">
          <p className="eco-kicker">
            <span className="eco-kicker-bar" aria-hidden="true" />
            {t('eyebrow')}
          </p>
          <h1 id="ecosystem-heading">{t('title')}</h1>
          <p className="eco-hero-lead">{t('description')}</p>

          {(canWrite || canAdmin || canSeed) && (
            <div className="eco-hero-actions">
              {canWrite && (
                <button
                  type="button"
                  className="eco-btn-hero-primary"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t('emptyAdd')}
                </button>
              )}
              {canAdmin && graph.nodes.length > 0 && (
                <button
                  type="button"
                  className="eco-btn-hero-secondary"
                  onClick={handleRebuild}
                  disabled={rebuilding}
                >
                  <RefreshCw
                    className={`size-4 ${rebuilding ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  {rebuilding ? t('refreshing') : t('refreshAction')}
                </button>
              )}
              {canSeed && (
                <button
                  type="button"
                  className="eco-btn-hero-secondary"
                  onClick={handleSeed}
                  disabled={seeding}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {seeding ? t('seeding') : t('seedAction')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3-Metric Rail + Updated Stamp */}
        <div className="eco-metrics-panel">
          <div className="eco-metrics-rail">
            <div className="eco-metric-cell">
              <span className="eco-metric-value">{number.format(graph.nodes.length)}</span>
              <span className="eco-metric-label">{t('metricCompanies')}</span>
            </div>
            <div className="eco-metric-cell">
              <span className="eco-metric-value">{number.format(graph.edges.length)}</span>
              <span className="eco-metric-label">{t('metricConnections')}</span>
            </div>
            <div className="eco-metric-cell">
              <span className="eco-metric-value">{number.format(graph.groups.length)}</span>
              <span className="eco-metric-label">{t('metricGroups')}</span>
            </div>
          </div>
          <p className="eco-updated-stamp">
            <Clock className="size-3.5" aria-hidden="true" />
            {t('updatedStamp', { date: updatedAt })}
          </p>
        </div>
      </section>

      {graph.nodes.length === 0 ? (
        <EmptyState
          icon={<Network className="size-6" aria-hidden="true" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canWrite && (
                <Button onClick={() => setAddOpen(true)} leadingIcon={<Plus className="size-4" />}>
                  {t('emptyAdd')}
                </Button>
              )}
              {canSeed && (
                <Button variant="secondary" onClick={handleSeed} loading={seeding}>
                  {seeding ? t('seeding') : t('seedAction')}
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          {/* Synced Filter Toolbar */}
          <div className="eco-toolbar" role="search">
            <div className="eco-toolbar-top">
              <div className="eco-search-wrap">
                <SearchInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onClear={() => setQuery('')}
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('searchPlaceholder')}
                />
              </div>

              <div className="eco-filter-status">
                <span>
                  {t('showingCount', {
                    shown: number.format(filteredNodes.length),
                    total: number.format(graph.nodes.length),
                  })}
                </span>
                {filtersActive && (
                  <button type="button" className="eco-reset-link" onClick={handleResetFilters}>
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    {t('resetFilters')}
                  </button>
                )}
              </div>
            </div>

            <div className="eco-group-pills" role="group" aria-label={t('groupFilter')}>
              <button
                type="button"
                className="eco-group-pill"
                aria-pressed={group === 'all'}
                onClick={() => setGroup('all')}
              >
                <span>{t('allGroups')}</span>
                <span className="eco-group-count">{number.format(graph.nodes.length)}</span>
              </button>
              {graph.groups.map((entry) => {
                const tone = groupTone(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="eco-group-pill"
                    aria-pressed={group === entry.id}
                    onClick={() => setGroup(entry.id)}
                  >
                    <span
                      className="eco-group-dot"
                      style={{ backgroundColor: tone.dot }}
                      aria-hidden="true"
                    />
                    <span>{entry.label}</span>
                    <span className="eco-group-count">{number.format(entry.members)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Studio Split: 10x Knowledge Graph + Visual Inspector Panel */}
          <div className="eco-studio">
            <EcosystemGraphCanvas
              graph={graph}
              selectedId={effectiveSelectedId}
              comparedId={comparedNeighbour?.node.id ?? null}
              filteredIds={filteredIds}
              group={group}
              focusRequest={focusRequest}
              onSelect={handleSelectCompany}
              onCompareEdge={handleCompareEdge}
              onResetFilters={handleResetFilters}
            />

            <aside className="eco-inspector" aria-label={selected?.name ?? t('selectPromptTitle')}>
              {selected ? (
                <>
                  {/* Selected Company Header */}
                  <div className="eco-inspector-section">
                    <div className="eco-inspector-header">
                      <span
                        className="eco-monogram-badge"
                        style={{ backgroundColor: groupTone(selected.group).fill }}
                        aria-hidden="true"
                      >
                        {companyMonogram(selected.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="eco-inspector-title-row">
                          <h2 className="eco-inspector-title">{selected.name}</h2>
                          {isKeyHub && (
                            <span className="eco-hub-badge" title={t('wellConnectedHint')}>
                              {t('wellConnected')}
                            </span>
                          )}
                        </div>
                        <p className="eco-inspector-meta">
                          {selectedGroup?.label ?? `${t('group')} ${selected.group + 1}`}
                          {selected.headcount
                            ? ` · ${t('employees', { count: selected.headcount })}`
                            : ''}
                          {selected.hqCity ? ` · ${selected.hqCity}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Closest Matches List */}
                  <div className="eco-inspector-section">
                    <p className="eco-section-label">{t('closestAccounts')}</p>
                    {selectedNeighbours.length > 0 ? (
                      <ul className="eco-matches-list">
                        {selectedNeighbours.slice(0, 5).map((neighbour) => {
                          const scorePct = Math.round(neighbour.score * 100);
                          const isCompared = comparedNeighbour?.node.id === neighbour.node.id;
                          return (
                            <li
                              key={neighbour.node.id}
                              className={`eco-match-row ${isCompared ? 'eco-match-row--active' : ''}`}
                            >
                              <button
                                type="button"
                                className="eco-match-select"
                                aria-pressed={isCompared}
                                onClick={() => setComparedId(neighbour.node.id)}
                              >
                                <span className="eco-match-select-top">
                                  <span className="eco-match-name">{neighbour.node.name}</span>
                                  <span className="eco-match-pct">
                                    {t('match', { score: scorePct })}
                                  </span>
                                </span>
                                <span className="eco-bar-track" aria-hidden="true">
                                  <span
                                    className="eco-bar-fill block"
                                    style={{ width: `${Math.max(4, scorePct)}%` }}
                                  />
                                </span>
                              </button>
                              <button
                                type="button"
                                className="eco-focus-btn"
                                onClick={() => handleFocusCompany(neighbour.node.id)}
                                aria-label={t('focusCompany', { name: neighbour.node.name })}
                                title={t('focusCompany', { name: neighbour.node.name })}
                              >
                                <Crosshair className="size-3.5" aria-hidden="true" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-[var(--border-default)] p-3.5">
                        <p className="text-ink text-sm font-semibold">{t('noNeighboursTitle')}</p>
                        <p className="text-muted-body mt-1 text-xs">
                          {t('noNeighboursDescription')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Why They Match (A ↔ B) */}
                  {comparedNeighbour && (
                    <div className="eco-inspector-section" data-why-match="true">
                      <p className="eco-section-label">{t('whatTheyShare')}</p>
                      <div className="eco-compare-head">
                        <p className="eco-compare-pair">
                          {selected.name} ↔ {comparedNeighbour.node.name}
                        </p>
                        <span className="eco-match-pct">
                          {t('match', { score: Math.round(comparedNeighbour.score * 100) })}
                        </span>
                      </div>
                      <div className="eco-signals-stack">
                        {comparedSignals.map((component) => {
                          const signalPct = Math.round(component.score * 100);
                          return (
                            <div key={component.family} className="eco-signal-row">
                              <div className="eco-signal-row-head">
                                <span>{t(familyLabelKey(component.family))}</span>
                                <span className="eco-signal-row-pct">
                                  {t('signalScore', { score: signalPct })}
                                </span>
                              </div>
                              <div className="eco-bar-track" aria-hidden="true">
                                <div
                                  className="eco-bar-fill"
                                  style={{ width: `${Math.max(3, signalPct)}%` }}
                                />
                              </div>
                              {component.evidence.length > 0 && (
                                <div className="eco-chips">
                                  {component.evidence.map((item) => (
                                    <span key={item} className="eco-chip">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* View Profile Footer CTA */}
                  <Link
                    href={`/ecosystem/accounts/${selected.id}`}
                    className="eco-inspector-footer"
                  >
                    <span>{t('openAccount')}</span>
                    <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <div className="eco-inspector-section flex flex-col gap-2 py-10">
                  <Users className="text-muted-tertiary size-6" aria-hidden="true" />
                  <p className="text-ink text-sm font-semibold">{t('selectPromptTitle')}</p>
                  <p className="text-muted-body text-sm">{t('selectPromptDescription')}</p>
                </div>
              )}
            </aside>
          </div>

          {/* Company Directory Table (synced with map filters) */}
          <section className="eco-directory" aria-labelledby="ecosystem-accounts-heading">
            <div className="eco-directory-header">
              <h2 id="ecosystem-accounts-heading">{t('accountListTitle')}</h2>
              <span className="eco-filter-status">
                {t('showingCount', {
                  shown: number.format(filteredNodes.length),
                  total: number.format(graph.nodes.length),
                })}
              </span>
            </div>

            {filteredNodes.length === 0 ? (
              <div className="eco-empty-filter">
                <h3>{t('noFilterMatchesTitle')}</h3>
                <p>{t('noFilterMatchesDescription')}</p>
                <Button variant="secondary" onClick={handleResetFilters} className="mt-2">
                  {t('resetFilters')}
                </Button>
              </div>
            ) : (
              <div className="eco-table-wrap">
                <table className="eco-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('accountHeader')}</th>
                      <th scope="col">{t('groupHeader')}</th>
                      <th scope="col">{t('employeesHeader')}</th>
                      <th scope="col">{t('closestHeader')}</th>
                      <th scope="col">{t('matchHeader')}</th>
                      <th scope="col">{t('actionsHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNodes.map((node) => {
                      const closestNeighbour = (neighboursByNode.get(node.id) ?? [])[0];
                      const matchPct = closestNeighbour
                        ? Math.round(closestNeighbour.score * 100)
                        : null;
                      const isRowSelected = node.id === effectiveSelectedId;
                      const tone = groupTone(node.group);
                      return (
                        <tr
                          key={node.id}
                          className={isRowSelected ? 'eco-row-selected' : undefined}
                          aria-selected={isRowSelected}
                          data-selected={isRowSelected ? 'true' : 'false'}
                          onClick={() => handleSelectCompany(node.id)}
                        >
                          <td>
                            <div className="eco-table-company">
                              <span
                                className="eco-monogram-badge eco-monogram-badge--sm"
                                style={{ backgroundColor: tone.fill }}
                                aria-hidden="true"
                              >
                                {companyMonogram(node.name)}
                              </span>
                              <div>
                                <span className="eco-table-company-name">{node.name}</span>
                                {node.hqCity && (
                                  <span className="eco-table-company-city">{node.hqCity}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="eco-table-group">
                              <span
                                className="eco-group-dot"
                                style={{ backgroundColor: tone.dot }}
                                aria-hidden="true"
                              />
                              {groupById.get(node.group)?.label ??
                                `${t('group')} ${node.group + 1}`}
                            </span>
                          </td>
                          <td className="text-muted-body tabular-nums">
                            {node.headcount ? number.format(node.headcount) : '—'}
                          </td>
                          <td className="text-muted-body">{closestNeighbour?.node.name ?? '—'}</td>
                          <td>
                            {matchPct !== null ? (
                              <div className="eco-inline-match">
                                <div className="eco-bar-track" aria-hidden="true">
                                  <div
                                    className="eco-bar-fill"
                                    style={{ width: `${Math.max(4, matchPct)}%` }}
                                  />
                                </div>
                                <span className="eco-match-pct">
                                  {t('signalScore', { score: matchPct })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-body">—</span>
                            )}
                          </td>
                          <td>
                            <Link
                              href={`/ecosystem/accounts/${node.id}`}
                              className="eco-profile-link"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {t('openAccount')}
                              <ArrowUpRight
                                className="size-3.5 rtl:-scale-x-100"
                                aria-hidden="true"
                              />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-muted-caption max-w-3xl text-xs">{t('note')}</p>
        </>
      )}

      {canWrite && (
        <AddAccountDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          tenantId={tenantId}
          onAdded={(createdId) => {
            if (createdId) {
              setSelectedId(createdId);
              setComparedId(null);
            }
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddAccountDialog({
  open,
  onOpenChange,
  tenantId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onAdded: (createdId?: string) => void;
}) {
  const t = useTranslations('ecosystem');
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    domain: '',
    headcount: '',
    hqCity: '',
    hqCountry: '',
    parentName: '',
    technologies: '',
    keywords: '',
    industryCodes: '',
    lists: '',
  });

  const update = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await createAccount(tenantId, {
        name: form.name.trim(),
        domain: form.domain.trim() || undefined,
        headcount: form.headcount ? Number(form.headcount) : undefined,
        hqCity: form.hqCity.trim() || undefined,
        hqCountry: form.hqCountry.trim() || undefined,
        parentName: form.parentName.trim() || undefined,
        technologies: splitList(form.technologies),
        keywords: splitList(form.keywords),
        industryCodes: splitList(form.industryCodes),
        lists: splitList(form.lists),
      });
      toast({
        title: t('addedTitle'),
        description: t('addedDescription'),
      });
      setForm({
        name: '',
        domain: '',
        headcount: '',
        hqCity: '',
        hqCountry: '',
        parentName: '',
        technologies: '',
        keywords: '',
        industryCodes: '',
        lists: '',
      });
      onOpenChange(false);
      onAdded(response?.account?.id);
    } catch (caught) {
      if (caught instanceof ApiError && caught.body.code === 'CONFLICT') {
        setError(t('conflictError'));
      } else {
        setError(t('genericError'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('add.title')}</DialogTitle>
          <DialogDescription>{t('add.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="account-name" label={t('add.nameLabel')} required>
              <Input
                id="account-name"
                value={form.name}
                onChange={(event) => update('name')(event.target.value)}
                autoFocus
              />
            </FormField>
            <FormField id="account-domain" label={t('add.domainLabel')} hint={t('add.domainHint')}>
              <Input
                id="account-domain"
                value={form.domain}
                onChange={(event) => update('domain')(event.target.value)}
                placeholder="acme.com"
              />
            </FormField>
            <FormField id="account-headcount" label={t('add.headcountLabel')}>
              <Input
                id="account-headcount"
                inputMode="numeric"
                value={form.headcount}
                onChange={(event) => update('headcount')(event.target.value)}
              />
            </FormField>
            <FormField id="account-parent" label={t('add.parentLabel')}>
              <Input
                id="account-parent"
                value={form.parentName}
                onChange={(event) => update('parentName')(event.target.value)}
              />
            </FormField>
            <FormField id="account-hq-city" label={t('add.hqCityLabel')}>
              <Input
                id="account-hq-city"
                value={form.hqCity}
                onChange={(event) => update('hqCity')(event.target.value)}
              />
            </FormField>
            <FormField id="account-hq-country" label={t('add.hqCountryLabel')}>
              <Input
                id="account-hq-country"
                value={form.hqCountry}
                onChange={(event) => update('hqCountry')(event.target.value)}
              />
            </FormField>
          </div>
          <FormField
            id="account-technologies"
            label={t('add.technologiesLabel')}
            hint={t('add.technologiesHint')}
          >
            <Textarea
              id="account-technologies"
              rows={2}
              value={form.technologies}
              onChange={(event) => update('technologies')(event.target.value)}
            />
          </FormField>
          <FormField
            id="account-keywords"
            label={t('add.keywordsLabel')}
            hint={t('add.keywordsHint')}
          >
            <Textarea
              id="account-keywords"
              rows={2}
              value={form.keywords}
              onChange={(event) => update('keywords')(event.target.value)}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="account-industries"
              label={t('add.industriesLabel')}
              hint={t('add.industriesHint')}
            >
              <Input
                id="account-industries"
                value={form.industryCodes}
                onChange={(event) => update('industryCodes')(event.target.value)}
              />
            </FormField>
            <FormField id="account-lists" label={t('add.listsLabel')} hint={t('add.listsHint')}>
              <Input
                id="account-lists"
                value={form.lists}
                onChange={(event) => update('lists')(event.target.value)}
              />
            </FormField>
          </div>
          {error && <p className="text-status-alert text-sm">{error}</p>}
          <DialogFooter className="mt-2 flex items-center justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('add.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={saving} disabled={!form.name.trim()}>
              {saving ? t('add.saving') : t('add.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
