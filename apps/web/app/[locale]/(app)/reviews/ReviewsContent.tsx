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
import { createReview } from '@/src/lib/reviews/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { Partner } from '@/src/lib/partners/types';
import type { Partnership } from '@/src/lib/partnerships/types';
import type { MemberSummary } from '@/src/lib/members/types';
import type { Review, ReviewStage } from '@/src/lib/reviews/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const NONE = '__none__';

const STAGE_TONE: Record<ReviewStage, 'neutral' | 'accent' | 'positive' | 'caution' | 'alert'> = {
  SCHEDULED: 'neutral',
  IN_PREPARATION: 'accent',
  IN_PROGRESS: 'accent',
  COMPLETED: 'positive',
  REOPENED: 'caution',
};

export function ReviewsContent({
  tenantId,
  initialReviews,
  partnerships,
  partners,
  members,
  currentRole,
}: {
  tenantId: string;
  initialReviews: Review[];
  partnerships: Partnership[];
  partners: Partner[];
  members: MemberSummary[];
  currentRole: MembershipRole;
}) {
  const t = useTranslations('reviews');
  const router = useRouter();
  const canWrite = WRITE_ROLES.includes(currentRole);
  const [formOpen, setFormOpen] = useState(false);

  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const partnerNameForPartnership = (partnershipId: string) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return '—';
    return partnerById.get(partnership.partnerId)?.displayName ?? '—';
  };
  const memberName = (userId: string | null) => members.find((m) => m.id === userId)?.name ?? '—';

  const columns: DataTableColumn<Review>[] = [
    {
      key: 'partnership',
      header: t('partnershipHeader'),
      render: (r) => (
        <div className="min-w-0">
          <p className="text-ink truncate text-sm font-medium">
            {partnerNameForPartnership(r.partnershipId)}
          </p>
          {r.period && <p className="text-muted-body truncate text-xs">{r.period}</p>}
        </div>
      ),
    },
    {
      key: 'scheduledFor',
      header: t('scheduledForHeader'),
      render: (r) => new Date(r.scheduledFor).toLocaleDateString(),
    },
    {
      key: 'stage',
      header: t('stageHeader'),
      render: (r) => <StatusBadge label={t(`stage.${r.stage}`)} tone={STAGE_TONE[r.stage]} />,
    },
    {
      key: 'owner',
      header: t('ownerHeader'),
      render: (r) => memberName(r.ownerId),
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
              {t('newReviewButton')}
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={initialReviews}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/reviews/${r.id}`)}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      {canWrite && (
        <CreateReviewDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={tenantId}
          partnerships={partnerships}
          partners={partners}
          members={members}
          onCreated={(id) => router.push(`/reviews/${id}`)}
        />
      )}
    </div>
  );
}

interface CreateFormValues {
  partnershipId: string;
  scheduledFor: string;
  period: string;
  ownerId: string;
}

function CreateReviewDialog({
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
  onCreated: (reviewId: string) => void;
}) {
  const t = useTranslations('reviews');
  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const [values, setValues] = useState<CreateFormValues>({
    partnershipId: NONE,
    scheduledFor: '',
    period: '',
    ownerId: NONE,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (values.partnershipId === NONE || !values.scheduledFor) return;
    setSubmitting(true);
    setError(null);
    try {
      const { review } = await createReview(tenantId, {
        partnershipId: values.partnershipId,
        scheduledFor: new Date(values.scheduledFor).toISOString(),
        period: values.period || undefined,
        ownerId: values.ownerId === NONE ? undefined : values.ownerId,
      });
      onOpenChange(false);
      onCreated(review.id);
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
          setValues({ partnershipId: NONE, scheduledFor: '', period: '', ownerId: NONE });
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

          <FormField id="review-partnership" label={t('partnershipLabel')}>
            <Select
              value={values.partnershipId}
              onValueChange={(value) => setValues((v) => ({ ...v, partnershipId: value }))}
            >
              <SelectTrigger id="review-partnership">
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

          <FormField id="review-scheduled-for" label={t('scheduledForLabel')}>
            <DateInput
              id="review-scheduled-for"
              required
              value={values.scheduledFor}
              onChange={(e) => setValues((v) => ({ ...v, scheduledFor: e.target.value }))}
            />
          </FormField>

          <FormField id="review-period" label={t('periodLabel')} hint={t('periodHint')}>
            <Input
              id="review-period"
              value={values.period}
              onChange={(e) => setValues((v) => ({ ...v, period: e.target.value }))}
            />
          </FormField>

          <FormField id="review-owner" label={t('ownerLabel')}>
            <Select
              value={values.ownerId}
              onValueChange={(value) => setValues((v) => ({ ...v, ownerId: value }))}
            >
              <SelectTrigger id="review-owner">
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

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={values.partnershipId === NONE || !values.scheduledFor}
              loading={submitting}
            >
              {submitting ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
