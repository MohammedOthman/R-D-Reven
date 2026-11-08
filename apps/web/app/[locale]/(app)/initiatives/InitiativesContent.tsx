'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Download } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  type DataTableColumn,
  StatusBadge,
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
  DialogFooter,
  DialogClose,
} from '@revn/ui';
import { useRouter } from '@/src/i18n/navigation';
import { createInitiative } from '@/src/lib/initiatives/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { Partner } from '@/src/lib/partners/types';
import type { Partnership } from '@/src/lib/partnerships/types';
import type { MemberSummary } from '@/src/lib/members/types';
import type { Initiative, InitiativeHealth, InitiativeStage } from '@/src/lib/initiatives/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
// RPT-02: export is available to anyone who can already see this list —
// same "Initiatives/actions" role set the list route itself is gated to
// (Reviewer excluded, a real, different row from Partnership's).
const EXPORT_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER'];
const NONE = '__none__';
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const STAGE_TONE: Record<InitiativeStage, 'neutral' | 'accent' | 'positive' | 'caution' | 'alert'> =
  {
    DRAFT: 'neutral',
    PROPOSED: 'neutral',
    APPROVED: 'accent',
    ACTIVE: 'positive',
    BLOCKED: 'caution',
    COMPLETED: 'positive',
    CANCELLED: 'alert',
  };

const HEALTH_TONE: Record<InitiativeHealth, 'positive' | 'caution' | 'alert'> = {
  HEALTHY: 'positive',
  NEEDS_ATTENTION: 'caution',
  CRITICAL: 'alert',
};

export function InitiativesContent({
  tenantId,
  initialInitiatives,
  partnerships,
  partners,
  members,
  currentRole,
}: {
  tenantId: string;
  initialInitiatives: Initiative[];
  partnerships: Partnership[];
  partners: Partner[];
  members: MemberSummary[];
  currentRole: MembershipRole;
}) {
  const t = useTranslations('initiatives');
  const router = useRouter();
  const canWrite = WRITE_ROLES.includes(currentRole);
  const canExport = EXPORT_ROLES.includes(currentRole);
  const [formOpen, setFormOpen] = useState(false);

  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const partnerNameForPartnership = (partnershipId: string) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return '—';
    return partnerById.get(partnership.partnerId)?.displayName ?? '—';
  };
  const memberName = (userId: string | null) => members.find((m) => m.id === userId)?.name ?? '—';

  const columns: DataTableColumn<Initiative>[] = [
    {
      key: 'objective',
      header: t('objectiveHeader'),
      render: (i) => (
        <div className="min-w-0">
          <p className="text-ink truncate text-sm font-medium">{i.objective}</p>
          <p className="text-muted-body truncate text-xs">
            {partnerNameForPartnership(i.partnershipId)}
          </p>
        </div>
      ),
    },
    {
      key: 'stage',
      header: t('stageHeader'),
      render: (i) => <StatusBadge label={t(`stage.${i.stage}`)} tone={STAGE_TONE[i.stage]} />,
    },
    {
      key: 'health',
      header: t('healthHeader'),
      render: (i) =>
        i.health ? (
          <StatusBadge label={t(`health.${i.health}`)} tone={HEALTH_TONE[i.health]} />
        ) : (
          '—'
        ),
    },
    {
      key: 'owner',
      header: t('ownerHeader'),
      render: (i) => memberName(i.ownerId),
    },
    {
      key: 'targetDate',
      header: t('targetDateHeader'),
      render: (i) => (i.targetDate ? new Date(i.targetDate).toLocaleDateString() : '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          canWrite || canExport ? (
            <div className="flex items-center gap-2">
              {canExport && (
                <a
                  href={`${API_URL}/tenants/${tenantId}/initiatives/export.csv`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  <Download className="size-4" aria-hidden="true" />
                  {t('exportButton')}
                </a>
              )}
              {canWrite && (
                <Button onClick={() => setFormOpen(true)} className="gap-1.5">
                  <Plus className="size-4" aria-hidden="true" />
                  {t('newInitiativeButton')}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={initialInitiatives}
        getRowId={(i) => i.id}
        onRowClick={(i) => router.push(`/initiatives/${i.id}`)}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      {canWrite && (
        <CreateInitiativeDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={tenantId}
          partnerships={partnerships}
          partners={partners}
          members={members}
          onCreated={(id) => router.push(`/initiatives/${id}`)}
        />
      )}
    </div>
  );
}

interface CreateFormValues {
  partnershipId: string;
  objective: string;
  ownerId: string;
  startDate: string;
  targetDate: string;
}

function CreateInitiativeDialog({
  open,
  onOpenChange,
  tenantId,
  partnerships,
  partners,
  members,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  partnerships: Partnership[];
  partners: Partner[];
  members: MemberSummary[];
  onCreated: (initiativeId: string) => void;
}) {
  const t = useTranslations('initiatives');
  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const [values, setValues] = useState<CreateFormValues>({
    partnershipId: NONE,
    objective: '',
    ownerId: NONE,
    startDate: '',
    targetDate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (values.partnershipId === NONE) return;
    setSubmitting(true);
    setError(null);
    try {
      const { initiative } = await createInitiative(tenantId, {
        partnershipId: values.partnershipId,
        objective: values.objective,
        ownerId: values.ownerId === NONE ? undefined : values.ownerId,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        targetDate: values.targetDate ? new Date(values.targetDate).toISOString() : undefined,
      });
      onOpenChange(false);
      onCreated(initiative.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : t('genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValues({
            partnershipId: NONE,
            objective: '',
            ownerId: NONE,
            startDate: '',
            targetDate: '',
          });
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('createDialogTitle')}</DialogTitle>
            <DialogDescription>{t('createDialogDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="init-partnership" label={t('partnershipLabel')}>
            <Select
              value={values.partnershipId}
              onValueChange={(value) => setValues((v) => ({ ...v, partnershipId: value }))}
            >
              <SelectTrigger id="init-partnership">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('selectPartnershipPlaceholder')}</SelectItem>
                {partnerships.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {partnerById.get(p.partnerId)?.displayName ?? p.partnerId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="init-objective" label={t('objectiveLabel')}>
            <Input
              id="init-objective"
              required
              value={values.objective}
              onChange={(e) => setValues((v) => ({ ...v, objective: e.target.value }))}
            />
          </FormField>

          <FormField id="init-owner" label={t('ownerLabel')}>
            <Select
              value={values.ownerId}
              onValueChange={(value) => setValues((v) => ({ ...v, ownerId: value }))}
            >
              <SelectTrigger id="init-owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('noneOption')}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField id="init-start-date" label={t('startDateLabel')}>
              <DateInput
                id="init-start-date"
                value={values.startDate}
                onChange={(e) => setValues((v) => ({ ...v, startDate: e.target.value }))}
              />
            </FormField>
            <FormField id="init-target-date" label={t('targetDateLabel')}>
              <DateInput
                id="init-target-date"
                value={values.targetDate}
                onChange={(e) => setValues((v) => ({ ...v, targetDate: e.target.value }))}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={values.partnershipId === NONE} loading={submitting}>
              {submitting ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
