'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  type DataTableColumn,
  StatusBadge,
  Button,
  FormField,
  Input,
  Textarea,
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
import { createOutcome } from '@/src/lib/outcomes/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { Partner } from '@/src/lib/partners/types';
import type { Partnership } from '@/src/lib/partnerships/types';
import type { Initiative } from '@/src/lib/initiatives/types';
import type { Outcome, OutcomeStatus } from '@/src/lib/outcomes/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const NONE = '__none__';

const STATUS_TONE: Record<OutcomeStatus, 'neutral' | 'accent' | 'positive' | 'caution' | 'alert'> =
  {
    DRAFT: 'neutral',
    SUBMITTED: 'accent',
    VERIFICATION_REQUIRED: 'caution',
    VERIFIED: 'positive',
    REJECTED: 'alert',
    SUPERSEDED: 'neutral',
  };

export function EvidenceOutcomesContent({
  tenantId,
  initialOutcomes,
  partnerships,
  partners,
  initiatives,
  currentRole,
}: {
  tenantId: string;
  initialOutcomes: Outcome[];
  partnerships: Partnership[];
  partners: Partner[];
  initiatives: Initiative[];
  currentRole: MembershipRole;
}) {
  const t = useTranslations('evidenceOutcomes');
  const router = useRouter();
  const canWrite = WRITE_ROLES.includes(currentRole);
  const [formOpen, setFormOpen] = useState(false);

  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const partnerNameForPartnership = (partnershipId: string) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return '—';
    return partnerById.get(partnership.partnerId)?.displayName ?? '—';
  };

  const columns: DataTableColumn<Outcome>[] = [
    {
      key: 'partnership',
      header: t('partnershipHeader'),
      render: (o) => (
        <div className="min-w-0">
          <p className="text-ink truncate text-sm font-medium">
            {partnerNameForPartnership(o.partnershipId)}
          </p>
          <p className="text-muted-body truncate text-xs">{o.type}</p>
        </div>
      ),
    },
    {
      key: 'claimedResult',
      header: t('claimedResultHeader'),
      render: (o) => <p className="max-w-xs truncate">{o.claimedResult}</p>,
    },
    {
      key: 'value',
      header: t('valueHeader'),
      render: (o) => (o.value ? `${o.value} ${o.unit ?? ''}` : '—'),
    },
    {
      key: 'status',
      header: t('statusHeader'),
      render: (o) => <StatusBadge label={t(`status.${o.status}`)} tone={STATUS_TONE[o.status]} />,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          canWrite ? (
            <Button onClick={() => setFormOpen(true)} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              {t('newOutcomeButton')}
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={initialOutcomes}
        getRowId={(o) => o.id}
        onRowClick={(o) => router.push(`/evidence-outcomes/${o.id}`)}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      {canWrite && (
        <CreateOutcomeDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={tenantId}
          partnerships={partnerships}
          partners={partners}
          initiatives={initiatives}
          onCreated={(id) => router.push(`/evidence-outcomes/${id}`)}
        />
      )}
    </div>
  );
}

interface CreateFormValues {
  partnershipId: string;
  initiativeId: string;
  type: string;
  claimedResult: string;
  value: string;
  unit: string;
  period: string;
}

const EMPTY_FORM: CreateFormValues = {
  partnershipId: NONE,
  initiativeId: NONE,
  type: '',
  claimedResult: '',
  value: '',
  unit: '',
  period: '',
};

function CreateOutcomeDialog({
  open,
  onOpenChange,
  tenantId,
  partnerships,
  partners,
  initiatives,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  partnerships: Partnership[];
  partners: Partner[];
  initiatives: Initiative[];
  onCreated: (outcomeId: string) => void;
}) {
  const t = useTranslations('evidenceOutcomes');
  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const [values, setValues] = useState<CreateFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleInitiatives = initiatives.filter((i) => i.partnershipId === values.partnershipId);

  const valueUnitMismatch = (!!values.value && !values.unit) || (!values.value && !!values.unit);
  const canSubmit =
    values.partnershipId !== NONE && !!values.type && !!values.claimedResult && !valueUnitMismatch;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { outcome } = await createOutcome(tenantId, {
        partnershipId: values.partnershipId,
        initiativeId: values.initiativeId === NONE ? undefined : values.initiativeId,
        type: values.type,
        claimedResult: values.claimedResult,
        value: values.value || undefined,
        unit: values.unit || undefined,
        period: values.period || undefined,
      });
      onOpenChange(false);
      onCreated(outcome.id);
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
          setValues(EMPTY_FORM);
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={t('cancel')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('createDialogTitle')}</DialogTitle>
            <DialogDescription>{t('createDialogDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="outcome-partnership" label={t('partnershipLabel')}>
            <Select
              value={values.partnershipId}
              onValueChange={(value) =>
                setValues((v) => ({ ...v, partnershipId: value, initiativeId: NONE }))
              }
            >
              <SelectTrigger id="outcome-partnership">
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

          <FormField
            id="outcome-initiative"
            label={t('initiativeLabel')}
            hint={t('initiativeHint')}
          >
            <Select
              value={values.initiativeId}
              onValueChange={(value) => setValues((v) => ({ ...v, initiativeId: value }))}
            >
              <SelectTrigger id="outcome-initiative">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('noneOption')}</SelectItem>
                {eligibleInitiatives.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.objective}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="outcome-type" label={t('typeLabel')} hint={t('typeHint')}>
            <Input
              id="outcome-type"
              required
              value={values.type}
              onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
            />
          </FormField>

          <FormField id="outcome-claimed-result" label={t('claimedResultLabel')}>
            <Textarea
              id="outcome-claimed-result"
              required
              value={values.claimedResult}
              onChange={(e) => setValues((v) => ({ ...v, claimedResult: e.target.value }))}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField id="outcome-value" label={t('valueLabel')}>
              <Input
                id="outcome-value"
                type="number"
                value={values.value}
                onChange={(e) => setValues((v) => ({ ...v, value: e.target.value }))}
              />
            </FormField>
            <FormField id="outcome-unit" label={t('unitLabel')}>
              <Input
                id="outcome-unit"
                value={values.unit}
                onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField id="outcome-period" label={t('periodLabel')} hint={t('periodHint')}>
            <Input
              id="outcome-period"
              value={values.period}
              onChange={(e) => setValues((v) => ({ ...v, period: e.target.value }))}
            />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit} loading={submitting}>
              {submitting ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
