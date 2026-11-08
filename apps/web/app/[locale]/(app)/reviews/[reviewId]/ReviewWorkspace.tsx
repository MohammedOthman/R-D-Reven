'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Plus } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  StatusBadge,
  FormField,
  Input,
  Textarea,
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
  EmptyState,
} from '@revn/ui';
import { useRouter } from '@/src/i18n/navigation';
import { updateReview } from '@/src/lib/reviews/client';
import { createDecisionForReview, updateDecision } from '@/src/lib/decisions/client';
import { AddActionDialog, UpdateActionDialog } from '@/src/components/actions/ActionDialogs';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { MemberSummary } from '@/src/lib/members/types';
import type { Action } from '@/src/lib/actions/types';
import type { Decision } from '@/src/lib/decisions/types';
import { VALID_REVIEW_TRANSITIONS, type Review, type ReviewStage } from '@/src/lib/reviews/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const APPROVE_ROLES: MembershipRole[] = ['OWNER', 'EXECUTIVE'];
const NONE = '__none__';

const STAGE_TONE: Record<ReviewStage, 'neutral' | 'accent' | 'positive' | 'caution' | 'alert'> = {
  SCHEDULED: 'neutral',
  IN_PREPARATION: 'accent',
  IN_PROGRESS: 'accent',
  COMPLETED: 'positive',
  REOPENED: 'caution',
};

const DECISION_TONE: Record<
  Decision['status'],
  'neutral' | 'accent' | 'positive' | 'caution' | 'alert'
> = {
  RECORDED: 'neutral',
  PENDING_APPROVAL: 'caution',
  APPROVED: 'positive',
  REJECTED: 'alert',
};

function errorMessage(err: unknown, fallback: string): string {
  if (
    err instanceof ApiError &&
    (err.body.code === 'CONFLICT' ||
      err.body.code === 'UNPROCESSABLE_ENTITY' ||
      err.body.code === 'FORBIDDEN')
  ) {
    return err.body.message;
  }
  return fallback;
}

export function ReviewWorkspace({
  tenantId,
  initialReview,
  partnerName,
  members,
  currentRole,
}: {
  tenantId: string;
  initialReview: Review;
  partnerName: string | null;
  members: MemberSummary[];
  currentRole: MembershipRole;
}) {
  const t = useTranslations('reviews');
  const router = useRouter();
  const canWrite = WRITE_ROLES.includes(currentRole);
  const canApprove = APPROVE_ROLES.includes(currentRole);

  const review = initialReview;
  const [completeOpen, setCompleteOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberName = (userId: string | null) => members.find((m) => m.id === userId)?.name ?? '—';

  const handleSimpleTransition = async (stage: ReviewStage) => {
    setBusy(true);
    setError(null);
    try {
      await updateReview(tenantId, review.id, { version: review.version, stage });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (decision: Decision, status: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    setError(null);
    try {
      await updateDecision(tenantId, decision.id, { version: decision.version, status });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setBusy(false);
    }
  };

  const nextStages = VALID_REVIEW_TRANSITIONS[review.stage];
  const pendingDecisions = (review.decisions ?? []).filter(
    (d) => d.status === 'PENDING_APPROVAL',
  ).length;
  const openActions = (review.actions ?? []).filter((a) =>
    ['OPEN', 'IN_PROGRESS', 'BLOCKED'].includes(a.status),
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={partnerName ? `${t('eyebrow')} — ${partnerName}` : t('eyebrow')}
        title={review.period || new Date(review.scheduledFor).toLocaleDateString()}
        description={t('workspaceDescription')}
        actions={
          <Button variant="ghost" onClick={() => router.push('/reviews')} className="gap-1.5">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('backButton')}
          </Button>
        }
      />

      {error && <p className="text-status-alert text-sm">{error}</p>}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={t(`stage.${review.stage}`)} tone={STAGE_TONE[review.stage]} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('ownerHeader')}
              </p>
              <p className="text-ink">{memberName(review.ownerId)}</p>
            </div>
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('scheduledForLabel')}
              </p>
              <p className="text-ink">{new Date(review.scheduledFor).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('nextReviewLabel')}
              </p>
              <p className="text-ink">
                {review.nextReviewAt ? new Date(review.nextReviewAt).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('participantsLabel')}
              </p>
              <p className="text-ink">
                {review.participantUserIds.length > 0
                  ? review.participantUserIds.map((id) => memberName(id)).join(', ')
                  : '—'}
              </p>
            </div>
          </div>

          {review.snapshot && (
            <div className="text-sm">
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('snapshotLabel')}
              </p>
              <p className="text-muted-body text-xs">
                {t('snapshotCapturedAt', {
                  date: review.snapshotAt ? new Date(review.snapshotAt).toLocaleString() : '',
                })}
              </p>
              <p className="text-ink mt-1">{JSON.stringify(review.snapshot)}</p>
            </div>
          )}

          {canWrite && nextStages.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-[var(--border-default)] pt-4">
              <p className="text-muted-body text-xs font-medium tracking-[var(--tracking-label)] uppercase">
                {t('availableTransitionsLabel')}
              </p>
              <div className="flex flex-wrap gap-2">
                {nextStages.map((stage) => (
                  <Button
                    key={stage}
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={busy}
                    onClick={() =>
                      stage === 'COMPLETED' ? setCompleteOpen(true) : handleSimpleTransition(stage)
                    }
                  >
                    {t('moveTo', { stage: t(`stage.${stage}`) })}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('decisionsTitle')}</CardTitle>
            <CardDescription>{t('decisionsDescription')}</CardDescription>
          </div>
          {canWrite && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDecisionOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('addDecisionButton')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!review.decisions || review.decisions.length === 0 ? (
            <EmptyState title={t('noDecisionsTitle')} />
          ) : (
            review.decisions.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-ink truncate text-sm font-medium">{d.rationale}</p>
                  <p className="text-muted-body truncate text-xs">
                    {d.type || t('untypedDecision')} · {memberName(d.deciderId)} ·{' '}
                    {new Date(d.effectiveDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={t(`decisionStatus.${d.status}`)}
                    tone={DECISION_TONE[d.status]}
                  />
                  {canApprove && d.status === 'PENDING_APPROVAL' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busy}
                        onClick={() => handleApprove(d, 'APPROVED')}
                      >
                        {t('approveButton')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busy}
                        onClick={() => handleApprove(d, 'REJECTED')}
                      >
                        {t('rejectButton')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('followupsTitle')}</CardTitle>
            <CardDescription>{t('followupsDescription')}</CardDescription>
          </div>
          {canWrite && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setActionOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('addActionButton')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!review.actions || review.actions.length === 0 ? (
            <EmptyState title={t('noActionsTitle')} />
          ) : (
            review.actions.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-ink truncate text-sm font-medium">{a.title}</p>
                  <p className="text-muted-body truncate text-xs">
                    {a.assigneeUserId ? memberName(a.assigneeUserId) : a.assigneeExternalName}
                    {a.dueDate ? ` · ${new Date(a.dueDate).toLocaleDateString()}` : ''}
                    {a.blockerReason ? ` · ${a.blockerReason}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={t(`actionStatus.${a.status}`)} />
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingAction(a)}>
                      {t('updateButton')}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <CompleteReviewDialog
          open={completeOpen}
          onOpenChange={setCompleteOpen}
          tenantId={tenantId}
          review={review}
          pendingDecisions={pendingDecisions}
          openActions={openActions}
          onSaved={() => router.refresh()}
        />
      )}

      {canWrite && (
        <AddDecisionDialog
          open={decisionOpen}
          onOpenChange={setDecisionOpen}
          tenantId={tenantId}
          reviewId={review.id}
          members={members}
          onSaved={() => router.refresh()}
        />
      )}

      {canWrite && (
        <AddActionDialog
          open={actionOpen}
          onOpenChange={setActionOpen}
          tenantId={tenantId}
          reviewId={review.id}
          members={members}
          onSaved={() => router.refresh()}
        />
      )}

      {canWrite && editingAction && (
        <UpdateActionDialog
          open={!!editingAction}
          onOpenChange={(next) => {
            if (!next) setEditingAction(null);
          }}
          tenantId={tenantId}
          action={editingAction}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function CompleteReviewDialog({
  open,
  onOpenChange,
  tenantId,
  review,
  pendingDecisions,
  openActions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  review: Review;
  pendingDecisions: number;
  openActions: number;
  onSaved: () => void;
}) {
  const t = useTranslations('reviews');
  const [nextReviewAt, setNextReviewAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = pendingDecisions > 0 || openActions > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateReview(tenantId, review.id, {
        version: review.version,
        stage: 'COMPLETED',
        nextReviewAt: new Date(nextReviewAt).toISOString(),
      });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('completeDialogTitle')}</DialogTitle>
            <DialogDescription>{t('completeDialogDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}
          {blocked && (
            <p className="text-status-alert text-sm">
              {t('completeBlockedWarning', { pendingDecisions, openActions })}
            </p>
          )}

          <FormField id="review-next" label={t('nextReviewLabel')}>
            <DateInput
              id="review-next"
              required
              value={nextReviewAt}
              onChange={(e) => setNextReviewAt(e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={blocked || !nextReviewAt} loading={submitting}>
              {t('completeButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddDecisionDialog({
  open,
  onOpenChange,
  tenantId,
  reviewId,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  reviewId: string;
  members: MemberSummary[];
  onSaved: () => void;
}) {
  const t = useTranslations('reviews');
  const [type, setType] = useState('');
  const [alternatives, setAlternatives] = useState('');
  const [rationale, setRationale] = useState('');
  const [deciderId, setDeciderId] = useState(NONE);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [impact, setImpact] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(NONE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setType('');
    setAlternatives('');
    setRationale('');
    setDeciderId(NONE);
    setEffectiveDate('');
    setImpact('');
    setRequiresApproval(NONE);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createDecisionForReview(tenantId, reviewId, {
        type: type || undefined,
        alternatives: alternatives || undefined,
        rationale,
        deciderId: deciderId === NONE ? undefined : deciderId,
        effectiveDate: new Date(effectiveDate).toISOString(),
        impact: impact || undefined,
        requiresApproval: requiresApproval === 'YES',
      });
      onOpenChange(false);
      reset();
      onSaved();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('addDecisionButton')}</DialogTitle>
            <DialogDescription>{t('addDecisionDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="decision-type" label={t('decisionTypeLabel')} hint={t('decisionTypeHint')}>
            <Input id="decision-type" value={type} onChange={(e) => setType(e.target.value)} />
          </FormField>

          <FormField id="decision-rationale" label={t('rationaleLabel')}>
            <Textarea
              id="decision-rationale"
              required
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </FormField>

          <FormField id="decision-alternatives" label={t('alternativesLabel')}>
            <Textarea
              id="decision-alternatives"
              value={alternatives}
              onChange={(e) => setAlternatives(e.target.value)}
            />
          </FormField>

          <FormField id="decision-impact" label={t('impactLabel')}>
            <Textarea
              id="decision-impact"
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField id="decision-decider" label={t('deciderLabel')} hint={t('deciderHint')}>
              <Select value={deciderId} onValueChange={setDeciderId}>
                <SelectTrigger id="decision-decider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('deciderDefaultOption')}</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="decision-date" label={t('effectiveDateLabel')}>
              <DateInput
                id="decision-date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </FormField>
          </div>

          <FormField
            id="decision-requires-approval"
            label={t('requiresApprovalLabel')}
            hint={t('requiresApprovalHint')}
          >
            <Select value={requiresApproval} onValueChange={setRequiresApproval}>
              <SelectTrigger id="decision-requires-approval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('noApprovalOption')}</SelectItem>
                <SelectItem value="YES">{t('requiresApprovalOption')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!rationale || !effectiveDate} loading={submitting}>
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
