'use client';

import { useWorkspaceDate } from '@/src/components/WorkspaceFormat';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Scale } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  type DataTableColumn,
  StatusBadge,
  Button,
  FormField,
  Input,
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
import { createAgreement } from '@/src/lib/agreements/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { Partner } from '@/src/lib/partners/types';
import type { Partnership } from '@/src/lib/partnerships/types';
import type { Agreement, AgreementStatus } from '@/src/lib/agreements/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const NONE = '__none__';

const STATUS_TONE: Record<
  AgreementStatus,
  'neutral' | 'accent' | 'positive' | 'caution' | 'alert'
> = {
  CAPTURED: 'neutral',
  IN_REVIEW: 'accent',
  EFFECTIVE: 'positive',
  AMENDED: 'positive',
  SUSPENDED: 'caution',
  EXPIRED: 'neutral',
  TERMINATED: 'alert',
};

export function AgreementsContent({
  tenantId,
  initialAgreements,
  partnerships,
  partners,
  currentRole,
}: {
  tenantId: string;
  initialAgreements: Agreement[];
  partnerships: Partnership[];
  partners: Partner[];
  currentRole: MembershipRole;
}) {
  const formatDate = useWorkspaceDate();
  const t = useTranslations('agreements');
  const router = useRouter();
  const canWrite = WRITE_ROLES.includes(currentRole);
  const [formOpen, setFormOpen] = useState(false);

  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const partnerNameForPartnership = (partnershipId: string) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return '—';
    return partnerById.get(partnership.partnerId)?.displayName ?? '—';
  };

  const columns: DataTableColumn<Agreement>[] = [
    {
      key: 'partnership',
      header: t('partnershipHeader'),
      render: (a) => (
        <div className="min-w-0">
          <p className="text-ink truncate text-sm font-medium">
            {partnerNameForPartnership(a.partnershipId)}
          </p>
          {a.sourceRef && <p className="text-muted-body truncate text-xs">{a.sourceRef}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('statusHeader'),
      render: (a) => <StatusBadge label={t(`status.${a.status}`)} tone={STATUS_TONE[a.status]} />,
    },
    {
      key: 'createdAt',
      header: t('createdAtHeader'),
      render: (a) => formatDate(a.createdAt),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => router.push('/agreements/rules')}
              className="gap-1.5"
            >
              <Scale className="size-4" aria-hidden="true" />
              {t('commercialRulesButton')}
            </Button>
            {canWrite && (
              <Button onClick={() => setFormOpen(true)} className="gap-1.5">
                <Plus className="size-4" aria-hidden="true" />
                {t('newAgreementButton')}
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={initialAgreements}
        getRowId={(a) => a.id}
        onRowClick={(a) => router.push(`/agreements/${a.id}`)}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      {canWrite && (
        <CreateAgreementDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={tenantId}
          partnerships={partnerships}
          partners={partners}
          onCreated={(id) => router.push(`/agreements/${id}`)}
        />
      )}
    </div>
  );
}

function CreateAgreementDialog({
  open,
  onOpenChange,
  tenantId,
  partnerships,
  partners,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  partnerships: Partnership[];
  partners: Partner[];
  onCreated: (agreementId: string) => void;
}) {
  const t = useTranslations('agreements');
  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const [partnershipId, setPartnershipId] = useState(NONE);
  const [sourceRef, setSourceRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (partnershipId === NONE) return;
    setSubmitting(true);
    setError(null);
    try {
      const { agreement } = await createAgreement(tenantId, {
        partnershipId,
        sourceRef: sourceRef || undefined,
      });
      onOpenChange(false);
      onCreated(agreement.id);
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
          setPartnershipId(NONE);
          setSourceRef('');
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

          <FormField id="agreement-partnership" label={t('partnershipLabel')}>
            <Select value={partnershipId} onValueChange={setPartnershipId}>
              <SelectTrigger id="agreement-partnership">
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
            id="agreement-source-ref"
            label={t('sourceRefLabel')}
            hint={t('sourceRefHint')}
          >
            <Input
              id="agreement-source-ref"
              value={sourceRef}
              onChange={(e) => setSourceRef(e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={partnershipId === NONE} loading={submitting}>
              {submitting ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
