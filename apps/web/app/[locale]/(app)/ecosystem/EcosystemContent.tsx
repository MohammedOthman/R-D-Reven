'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Network, Plus, Users } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
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
  PageHeader,
  Pill,
  SearchInput,
  Textarea,
  useToast,
} from '@revn/ui';
import { Link, useRouter } from '@/src/i18n/navigation';
import { ApiError } from '@/src/lib/api/error';
import { createAccount, seedEcosystemExample } from '@/src/lib/ecosystem/client';
import type { EcosystemGraph, GraphNode } from '@/src/lib/ecosystem/types';
import type { MembershipRole } from '@/src/lib/tenant/types';
import { EcosystemGraphCanvas } from '@/src/components/ecosystem/EcosystemGraphCanvas';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const SEED_ROLES: MembershipRole[] = ['OWNER', 'ADMIN'];

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

function evidenceFor(neighbour: Neighbour | undefined, family: string): string[] {
  return neighbour?.components.find((component) => component.family === family)?.evidence ?? [];
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
  const canSeed = pilotMode && SEED_ROLES.includes(currentRole);

  const [selectedId, setSelectedId] = useState<string | null>(graph.nodes[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<number | 'all'>('all');
  const [seeding, setSeeding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph]);
  const groupById = useMemo(() => new Map(graph.groups.map((entry) => [entry.id, entry])), [graph]);
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
    for (const list of map.values()) list.sort((a, b) => b.score - a.score);
    return map;
  }, [graph, nodeById]);

  const selected = selectedId ? (nodeById.get(selectedId) ?? null) : null;
  const selectedNeighbours = selectedId ? (neighboursByNode.get(selectedId) ?? []) : [];
  const closest = selectedNeighbours[0];
  const selectedGroup = selected ? (groupById.get(selected.group) ?? null) : null;
  const wellConnected =
    selected !== null &&
    graph.nodes.length > 1 &&
    selected.centrality >=
      [...graph.nodes].sort((a, b) => a.centrality - b.centrality)[
        Math.floor(graph.nodes.length * 0.75)
      ]!.centrality;

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

  const updatedAt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(graph.provenance.refreshedAt),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          graph.nodes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {canSeed && (
                <Button variant="secondary" onClick={handleSeed} loading={seeding}>
                  {seeding ? t('seeding') : t('seedAction')}
                </Button>
              )}
              {canWrite && (
                <Button onClick={() => setAddOpen(true)} leadingIcon={<Plus className="size-4" />}>
                  {t('emptyAdd')}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {graph.nodes.length === 0 ? (
        <EmptyState
          icon={<Network className="size-6" aria-hidden="true" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canWrite && <Button onClick={() => setAddOpen(true)}>{t('emptyAdd')}</Button>}
              {canSeed && (
                <Button variant="secondary" onClick={handleSeed} loading={seeding}>
                  {t('seedAction')}
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md flex-1">
              <SearchInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery('')}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-body text-xs font-medium">{t('groupFilter')}</span>
              <Pill selected={group === 'all'} onClick={() => setGroup('all')}>
                {t('allGroups')}
              </Pill>
              {graph.groups.map((entry) => (
                <Pill
                  key={entry.id}
                  selected={group === entry.id}
                  onClick={() => setGroup(entry.id)}
                >
                  {entry.label}
                </Pill>
              ))}
            </div>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="overflow-hidden">
              <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted-body text-xs font-medium">{t('legendTitle')}</p>
                  <p className="text-muted-caption text-xs">{updatedAt}</p>
                </div>
                <p className="text-muted-body mt-2 text-xs">{t('graphHelp')}</p>
                <div className="text-muted-body mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>{t('legendSharedTools')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('legendSharedTopics')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('legendSameIndustry')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('legendSameList')}</span>
                </div>
              </div>
              <CardContent className="p-2 sm:p-4">
                <EcosystemGraphCanvas
                  graph={graph}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  query={query}
                  group={group}
                />
              </CardContent>
            </Card>

            <Card className="xl:sticky xl:top-4">
              <CardContent className="flex flex-col gap-5">
                {selected ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-ink text-lg font-bold tracking-[var(--tracking-display)]">
                          {selected.name}
                        </h2>
                        {wellConnected && (
                          <span
                            className="bg-accent/10 text-accent-deep rounded-pill px-2 py-0.5 text-[11px] font-semibold"
                            title={t('wellConnectedHint')}
                          >
                            {t('wellConnected')}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-body text-sm">
                        {selectedGroup?.label ?? t('group')}
                        {selected.headcount
                          ? ` · ${t('employees', { count: selected.headcount })}`
                          : ''}
                        {selected.hqCity ? ` · ${selected.hqCity}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-muted-body text-xs font-semibold tracking-[var(--tracking-label)] uppercase">
                        {t('closestAccounts')}
                      </p>
                      {selectedNeighbours.length ? (
                        <ul className="flex flex-col gap-2">
                          {selectedNeighbours.slice(0, 4).map((neighbour) => (
                            <li key={neighbour.node.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedId(neighbour.node.id)}
                                className="hover:bg-canvas flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-start"
                              >
                                <span className="text-ink truncate text-sm font-medium">
                                  {neighbour.node.name}
                                </span>
                                <span className="text-muted-body text-xs tabular-nums">
                                  {t('match', { score: Math.round(neighbour.score * 100) })}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex flex-col gap-1 rounded-md border border-dashed border-[var(--border-default)] p-3">
                          <p className="text-ink text-sm font-medium">{t('noNeighboursTitle')}</p>
                          <p className="text-muted-body text-xs">{t('noNeighboursDescription')}</p>
                        </div>
                      )}
                    </div>

                    {closest && (
                      <div className="flex flex-col gap-3">
                        <p className="text-muted-body text-xs font-semibold tracking-[var(--tracking-label)] uppercase">
                          {t('whatTheyShare')}
                        </p>
                        <p className="text-muted-body text-xs">
                          {selected.name} ↔ {closest.node.name}
                        </p>
                        {evidenceFor(closest, 'technologies').length > 0 && (
                          <EvidenceGroup
                            label={t('tools')}
                            values={evidenceFor(closest, 'technologies')}
                          />
                        )}
                        {evidenceFor(closest, 'keywords').length > 0 && (
                          <EvidenceGroup
                            label={t('topics')}
                            values={evidenceFor(closest, 'keywords')}
                          />
                        )}
                        {evidenceFor(closest, 'industries').length > 0 && (
                          <EvidenceGroup
                            label={t('industry')}
                            values={evidenceFor(closest, 'industries')}
                          />
                        )}
                        {evidenceFor(closest, 'lists').length > 0 && (
                          <EvidenceGroup
                            label={t('lists')}
                            values={evidenceFor(closest, 'lists')}
                          />
                        )}
                      </div>
                    )}

                    <Link
                      href={`/ecosystem/accounts/${selected.id}`}
                      className="text-accent text-sm font-semibold hover:underline"
                    >
                      {t('openAccount')}
                    </Link>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 py-8">
                    <Users className="text-muted-tertiary size-6" aria-hidden="true" />
                    <p className="text-ink text-sm font-semibold">{t('selectPromptTitle')}</p>
                    <p className="text-muted-body text-sm">{t('selectPromptDescription')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <section className="flex flex-col gap-3" aria-labelledby="ecosystem-accounts-heading">
            <h2
              id="ecosystem-accounts-heading"
              className="font-display text-ink text-lg font-bold tracking-[var(--tracking-display)]"
            >
              {t('accountListTitle')}
            </h2>
            <div className="bg-card overflow-x-auto rounded-lg border border-[var(--border-default)]">
              <table className="font-body w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-canvas/60 border-b border-[var(--border-default)]">
                    {[
                      t('accountHeader'),
                      t('groupHeader'),
                      t('employeesHeader'),
                      t('closestHeader'),
                      t('matchHeader'),
                    ].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="text-muted-body px-4 py-3 text-start text-xs font-semibold tracking-[var(--tracking-label)] uppercase"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {graph.nodes.map((node) => {
                    const closestNeighbour = (neighboursByNode.get(node.id) ?? [])[0];
                    return (
                      <tr
                        key={node.id}
                        className="hover:bg-canvas/60 cursor-pointer border-b border-[var(--border-subtle)] last:border-0"
                        onClick={() => setSelectedId(node.id)}
                      >
                        <td className="text-ink px-4 py-3 font-medium">{node.name}</td>
                        <td className="text-muted-body px-4 py-3">
                          {groupById.get(node.group)?.label ?? `${t('group')} ${node.group + 1}`}
                        </td>
                        <td className="text-muted-body px-4 py-3 tabular-nums">
                          {node.headcount ? number.format(node.headcount) : '—'}
                        </td>
                        <td className="text-muted-body px-4 py-3">
                          {closestNeighbour?.node.name ?? '—'}
                        </td>
                        <td className="text-muted-body px-4 py-3 tabular-nums">
                          {closestNeighbour
                            ? t('match', {
                                score: Math.round(closestNeighbour.score * 100),
                              })
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-muted-caption max-w-3xl text-xs">{t('note')}</p>
        </>
      )}

      {canWrite && (
        <AddAccountDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          tenantId={tenantId}
          onAdded={() => router.refresh()}
        />
      )}
    </div>
  );
}

function EvidenceGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-caption text-[11px] font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="bg-canvas text-muted-body rounded-pill border border-[var(--border-subtle)] px-2 py-0.5 text-[11px]"
          >
            {value}
          </span>
        ))}
      </div>
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
  onAdded: () => void;
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
      await createAccount(tenantId, {
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
      onAdded();
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
