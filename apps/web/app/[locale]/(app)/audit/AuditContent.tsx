'use client';

import { useWorkspaceDate } from '@/src/components/WorkspaceFormat';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import {
  PageHeader,
  FilterBar,
  DataTable,
  type DataTableColumn,
  Button,
  FormField,
  Input,
  DateInput,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@revn/ui';
import { listAuditEvents, auditExportUrl } from '@/src/lib/audit/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { MemberSummary } from '@/src/lib/members/types';
import type { AuditEvent, AuditEventFilters } from '@/src/lib/audit/types';

const NONE = '__none__';
const EMPTY_FILTERS: AuditEventFilters = {};

export function AuditContent({
  tenantId,
  initialEvents,
  initialNextCursor,
  members,
  currentRole,
}: {
  tenantId: string;
  initialEvents: AuditEvent[];
  initialNextCursor: string | null;
  members: MemberSummary[];
  currentRole: MembershipRole;
}) {
  const formatDate = useWorkspaceDate();
  const t = useTranslations('audit');
  const [filters, setFilters] = useState<AuditEventFilters>(EMPTY_FILTERS);
  const [events, setEvents] = useState(initialEvents);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const memberName = (userId: string | null) => members.find((m) => m.id === userId)?.name ?? '—';

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await listAuditEvents(tenantId, filters);
      setEvents(result.events);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listAuditEvents(tenantId, { ...filters, cursor: nextCursor });
      setEvents((prev) => [...prev, ...result.events]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  const columns: DataTableColumn<AuditEvent>[] = [
    {
      key: 'createdAt',
      header: t('timeHeader'),
      render: (e) => formatDate(e.createdAt, true),
    },
    {
      key: 'actor',
      header: t('actorHeader'),
      render: (e) => memberName(e.actorId),
    },
    {
      key: 'action',
      header: t('actionHeader'),
      render: (e) => e.action,
    },
    {
      key: 'object',
      header: t('objectHeader'),
      render: (e) => (
        <span className="text-muted-body text-xs">
          {e.objectType} · {e.objectId}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />

      {currentRole === 'MANAGER' || currentRole === 'REVIEWER' ? (
        <p className="text-muted-body text-sm">{t('scopedNotice')}</p>
      ) : null}

      <form onSubmit={runSearch}>
        <FilterBar
          filters={
            <>
              <FormField id="audit-object-type" label={t('objectTypeLabel')}>
                <Input
                  id="audit-object-type"
                  placeholder={t('objectTypePlaceholder')}
                  value={filters.objectType ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, objectType: e.target.value }))}
                />
              </FormField>
              <FormField id="audit-object-id" label={t('objectIdLabel')}>
                <Input
                  id="audit-object-id"
                  value={filters.objectId ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, objectId: e.target.value }))}
                />
              </FormField>
              <FormField id="audit-action" label={t('actionLabel')}>
                <Input
                  id="audit-action"
                  placeholder={t('actionPlaceholder')}
                  value={filters.action ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
                />
              </FormField>
              <FormField id="audit-actor" label={t('actorHeader')}>
                <Select
                  value={filters.actorId ?? NONE}
                  onValueChange={(value) =>
                    setFilters((f) => ({ ...f, actorId: value === NONE ? undefined : value }))
                  }
                >
                  <SelectTrigger id="audit-actor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t('anyActorOption')}</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="audit-from" label={t('fromLabel')}>
                <DateInput
                  id="audit-from"
                  value={filters.from ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </FormField>
              <FormField id="audit-to" label={t('toLabel')}>
                <DateInput
                  id="audit-to"
                  value={filters.to ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </FormField>
              <FormField id="audit-correlation" label={t('correlationLabel')}>
                <Input
                  id="audit-correlation"
                  value={filters.correlationId ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, correlationId: e.target.value }))}
                />
              </FormField>
            </>
          }
          actions={
            <>
              <a
                href={auditExportUrl(tenantId, filters)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                <Download className="size-4" aria-hidden="true" />
                {t('exportButton')}
              </a>
              <Button type="button" variant="ghost" onClick={clearFilters}>
                {t('clearFilters')}
              </Button>
              <Button type="submit" loading={loading}>
                {t('search')}
              </Button>
            </>
          }
        />
      </form>

      {error && <p className="text-status-alert text-sm">{error}</p>}

      <DataTable
        columns={columns}
        data={events}
        getRowId={(e) => e.id}
        onRowClick={(e) => setSelected(e)}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={loading} onClick={loadMore}>
            {t('loadMore')}
          </Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{selected.action}</DialogTitle>
                <DialogDescription>
                  {selected.objectType} · {selected.objectId}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                    {t('actorHeader')}
                  </p>
                  <p className="text-ink">{memberName(selected.actorId)}</p>
                </div>
                <div>
                  <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                    {t('timeHeader')}
                  </p>
                  <p className="text-ink">{formatDate(selected.createdAt, true)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                    {t('correlationLabel')}
                  </p>
                  <p className="text-ink font-mono text-xs">{selected.correlationId}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-body mb-1 text-xs font-medium tracking-[var(--tracking-label)] uppercase">
                    {t('beforeLabel')}
                  </p>
                  <pre className="bg-canvas max-h-64 overflow-auto rounded-md border border-[var(--border-default)] p-2 text-xs">
                    {selected.before ? JSON.stringify(selected.before, null, 2) : t('noneOption')}
                  </pre>
                </div>
                <div>
                  <p className="text-muted-body mb-1 text-xs font-medium tracking-[var(--tracking-label)] uppercase">
                    {t('afterLabel')}
                  </p>
                  <pre className="bg-canvas max-h-64 overflow-auto rounded-md border border-[var(--border-default)] p-2 text-xs">
                    {selected.after ? JSON.stringify(selected.after, null, 2) : t('noneOption')}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
