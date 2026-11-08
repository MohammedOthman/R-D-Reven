'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Plus, Upload } from 'lucide-react';
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
import { updateOutcome } from '@/src/lib/outcomes/client';
import { createContribution } from '@/src/lib/contributions/client';
import { createEvidence, uploadEvidenceFile } from '@/src/lib/evidence/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { MemberSummary } from '@/src/lib/members/types';
import type { EvidenceClassification } from '@/src/lib/contributions/types';
import type { Evidence } from '@/src/lib/evidence/types';
import {
  VALID_OUTCOME_TRANSITIONS,
  type Outcome,
  type OutcomeStatus,
} from '@/src/lib/outcomes/types';

const SUBMIT_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const VERIFY_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'REVIEWER'];
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

export function OutcomeWorkspace({
  tenantId,
  initialOutcome,
  partnerName,
  members,
  currentRole,
  currentUserId,
}: {
  tenantId: string;
  initialOutcome: Outcome;
  partnerName: string | null;
  members: MemberSummary[];
  currentRole: MembershipRole;
  currentUserId: string;
}) {
  const t = useTranslations('evidenceOutcomes');
  const router = useRouter();
  const canSubmit = SUBMIT_ROLES.includes(currentRole);
  // Server-enforced; mirrored here only to decide which buttons to show.
  const canVerify =
    VERIFY_ROLES.includes(currentRole) &&
    initialOutcome.createdById !== currentUserId &&
    (currentRole !== 'REVIEWER' || initialOutcome.verifierId === currentUserId);

  const outcome = initialOutcome;
  const [submitOpen, setSubmitOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [requestMoreOpen, setRequestMoreOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const memberName = (userId: string | null) => members.find((m) => m.id === userId)?.name ?? '—';

  const nextStatuses = VALID_OUTCOME_TRANSITIONS[outcome.status];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={partnerName ? `${t('eyebrow')} — ${partnerName}` : t('eyebrow')}
        title={outcome.type}
        description={t('workspaceDescription')}
        actions={
          <Button
            variant="ghost"
            onClick={() => router.push('/evidence-outcomes')}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('backButton')}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={t(`status.${outcome.status}`)} tone={STATUS_TONE[outcome.status]} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('claimedResultHeader')}
              </p>
              <p className="text-ink">{outcome.claimedResult}</p>
            </div>
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('valueHeader')}
              </p>
              <p className="text-ink">
                {outcome.value ? `${outcome.value} ${outcome.unit ?? ''}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('periodLabel')}
              </p>
              <p className="text-ink">{outcome.period ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('verifierLabel')}
              </p>
              <p className="text-ink">{memberName(outcome.verifierId)}</p>
            </div>
          </div>

          {outcome.rejectionReason && (
            <p className="text-status-alert text-sm">
              {t('rejectionReasonPrefix')} {outcome.rejectionReason}
            </p>
          )}
          {outcome.verifierDisposition && outcome.status === 'VERIFICATION_REQUIRED' && (
            <p className="text-status-caution text-sm">
              {t('verifierDispositionPrefix')} {outcome.verifierDisposition}
            </p>
          )}

          {nextStatuses.length > 0 && (canSubmit || canVerify) && (
            <div className="flex flex-col gap-2 border-t border-[var(--border-default)] pt-4">
              <p className="text-muted-body text-xs font-medium tracking-[var(--tracking-label)] uppercase">
                {t('availableActionsLabel')}
              </p>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.includes('SUBMITTED') && canSubmit && (
                  <Button variant="secondary" size="sm" onClick={() => setSubmitOpen(true)}>
                    {t('submitButton')}
                  </Button>
                )}
                {nextStatuses.includes('VERIFIED') && canVerify && (
                  <Button variant="secondary" size="sm" onClick={() => setVerifyOpen(true)}>
                    {t('verifyButton')}
                  </Button>
                )}
                {nextStatuses.includes('REJECTED') && canVerify && (
                  <Button variant="secondary" size="sm" onClick={() => setRejectOpen(true)}>
                    {t('rejectButton')}
                  </Button>
                )}
                {nextStatuses.includes('VERIFICATION_REQUIRED') && canVerify && (
                  <Button variant="secondary" size="sm" onClick={() => setRequestMoreOpen(true)}>
                    {t('requestMoreEvidenceButton')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('contributionsTitle')}</CardTitle>
            <CardDescription>{t('contributionsDescription')}</CardDescription>
          </div>
          {canSubmit && outcome.status === 'DRAFT' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setContributionOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('addContributionButton')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!outcome.contributions || outcome.contributions.length === 0 ? (
            <EmptyState title={t('noContributionsTitle')} />
          ) : (
            outcome.contributions.map((c) => (
              <div
                key={c.id}
                className="rounded-md border border-[var(--border-default)] px-3 py-2"
              >
                <p className="text-ink truncate text-sm font-medium">{c.narrative}</p>
                <p className="text-muted-body truncate text-xs">
                  {c.type} · {memberName(c.actorId)} · {new Date(c.observedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('evidenceTitle')}</CardTitle>
            <CardDescription>{t('evidenceDescription')}</CardDescription>
          </div>
          {canSubmit &&
            (outcome.status === 'DRAFT' || outcome.status === 'VERIFICATION_REQUIRED') && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEvidenceOpen(true)}
                className="gap-1.5"
              >
                <Plus className="size-4" aria-hidden="true" />
                {t('addEvidenceButton')}
              </Button>
            )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!outcome.evidence || outcome.evidence.length === 0 ? (
            <EmptyState title={t('noEvidenceTitle')} />
          ) : (
            outcome.evidence.map((e) => (
              <EvidenceRow
                key={e.id}
                tenantId={tenantId}
                evidence={e}
                canWrite={canSubmit}
                onSaved={() => router.refresh()}
              />
            ))
          )}
        </CardContent>
      </Card>

      {canSubmit && (
        <SubmitDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          tenantId={tenantId}
          outcome={outcome}
          members={members}
          onSaved={() => router.refresh()}
        />
      )}
      {canVerify && (
        <VerifyDialog
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          tenantId={tenantId}
          outcome={outcome}
          onSaved={() => router.refresh()}
        />
      )}
      {canVerify && (
        <ReasonDialog
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          tenantId={tenantId}
          outcome={outcome}
          status="REJECTED"
          titleKey="rejectDialogTitle"
          descriptionKey="rejectDialogDescription"
          onSaved={() => router.refresh()}
        />
      )}
      {canVerify && (
        <ReasonDialog
          open={requestMoreOpen}
          onOpenChange={setRequestMoreOpen}
          tenantId={tenantId}
          outcome={outcome}
          status="VERIFICATION_REQUIRED"
          titleKey="requestMoreEvidenceDialogTitle"
          descriptionKey="requestMoreEvidenceDialogDescription"
          onSaved={() => router.refresh()}
        />
      )}
      {canSubmit && outcome.status === 'DRAFT' && (
        <AddContributionDialog
          open={contributionOpen}
          onOpenChange={setContributionOpen}
          tenantId={tenantId}
          outcomeId={outcome.id}
          members={members}
          onSaved={() => router.refresh()}
        />
      )}
      {canSubmit && (
        <AddEvidenceDialog
          open={evidenceOpen}
          onOpenChange={setEvidenceOpen}
          tenantId={tenantId}
          outcomeId={outcome.id}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function SubmitDialog({
  open,
  onOpenChange,
  tenantId,
  outcome,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  outcome: Outcome;
  members: MemberSummary[];
  onSaved: () => void;
}) {
  const t = useTranslations('evidenceOutcomes');
  const [verifierId, setVerifierId] = useState(outcome.verifierId ?? NONE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (verifierId === NONE) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateOutcome(tenantId, outcome.id, {
        version: outcome.version,
        status: 'SUBMITTED',
        verifierId,
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
            <DialogTitle>{t('submitDialogTitle')}</DialogTitle>
            <DialogDescription>{t('submitDialogDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="outcome-verifier" label={t('verifierLabel')}>
            <Select value={verifierId} onValueChange={setVerifierId}>
              <SelectTrigger id="outcome-verifier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('selectVerifierPlaceholder')}</SelectItem>
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
            <Button type="submit" disabled={verifierId === NONE} loading={submitting}>
              {t('submitButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VerifyDialog({
  open,
  onOpenChange,
  tenantId,
  outcome,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  outcome: Outcome;
  onSaved: () => void;
}) {
  const t = useTranslations('evidenceOutcomes');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasEvidence = (outcome.evidence?.length ?? 0) > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateOutcome(tenantId, outcome.id, {
        version: outcome.version,
        status: 'VERIFIED',
        verifierDisposition: note || undefined,
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
            <DialogTitle>{t('verifyDialogTitle')}</DialogTitle>
            <DialogDescription>{t('verifyDialogDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}
          {!hasEvidence && <p className="text-status-alert text-sm">{t('noEvidenceWarning')}</p>}

          <FormField id="outcome-verify-note" label={t('verifierDispositionLabel')}>
            <Textarea
              id="outcome-verify-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!hasEvidence} loading={submitting}>
              {t('verifyButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({
  open,
  onOpenChange,
  tenantId,
  outcome,
  status,
  titleKey,
  descriptionKey,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  outcome: Outcome;
  status: 'REJECTED' | 'VERIFICATION_REQUIRED';
  titleKey: string;
  descriptionKey: string;
  onSaved: () => void;
}) {
  const t = useTranslations('evidenceOutcomes');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateOutcome(tenantId, outcome.id, {
        version: outcome.version,
        status,
        rejectionReason: status === 'REJECTED' ? reason : undefined,
        verifierDisposition: status === 'VERIFICATION_REQUIRED' ? reason : undefined,
      });
      onOpenChange(false);
      setReason('');
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
            <DialogTitle>{t(titleKey)}</DialogTitle>
            <DialogDescription>{t(descriptionKey)}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="outcome-reason" label={t('reasonLabel')}>
            <Textarea
              id="outcome-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!reason.trim()} loading={submitting}>
              {t('confirmButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddContributionDialog({
  open,
  onOpenChange,
  tenantId,
  outcomeId,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  outcomeId: string;
  members: MemberSummary[];
  onSaved: () => void;
}) {
  const t = useTranslations('evidenceOutcomes');
  const [type, setType] = useState('');
  const [actorId, setActorId] = useState(NONE);
  const [observedAt, setObservedAt] = useState('');
  const [narrative, setNarrative] = useState('');
  const [classification, setClassification] = useState<EvidenceClassification>('INTERNAL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setType('');
    setActorId(NONE);
    setObservedAt('');
    setNarrative('');
    setClassification('INTERNAL');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!type || !observedAt || !narrative) return;
    setSubmitting(true);
    setError(null);
    try {
      await createContribution(tenantId, {
        outcomeId,
        type,
        actorId: actorId === NONE ? undefined : actorId,
        observedAt: new Date(observedAt).toISOString(),
        narrative,
        classification,
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
            <DialogTitle>{t('addContributionButton')}</DialogTitle>
            <DialogDescription>{t('addContributionDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="contribution-type" label={t('contributionTypeLabel')}>
            <Input
              id="contribution-type"
              required
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </FormField>

          <FormField id="contribution-narrative" label={t('narrativeLabel')}>
            <Textarea
              id="contribution-narrative"
              required
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField id="contribution-actor" label={t('actorLabel')} hint={t('actorHint')}>
              <Select value={actorId} onValueChange={setActorId}>
                <SelectTrigger id="contribution-actor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('actorDefaultOption')}</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="contribution-observed" label={t('observedAtLabel')}>
              <DateInput
                id="contribution-observed"
                required
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
              />
            </FormField>
          </div>

          <FormField id="contribution-classification" label={t('classificationLabel')}>
            <Select
              value={classification}
              onValueChange={(value) => setClassification(value as EvidenceClassification)}
            >
              <SelectTrigger id="contribution-classification">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNAL">{t('classificationInternal')}</SelectItem>
                <SelectItem value="SHAREABLE">{t('classificationShareable')}</SelectItem>
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
              disabled={!type || !observedAt || !narrative}
              loading={submitting}
            >
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddEvidenceDialog({
  open,
  onOpenChange,
  tenantId,
  outcomeId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  outcomeId: string;
  onSaved: () => void;
}) {
  const t = useTranslations('evidenceOutcomes');
  const [source, setSource] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [classification, setClassification] = useState<EvidenceClassification>('INTERNAL');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSource('');
    setObservedAt('');
    setClassification('INTERNAL');
    setFile(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!source || !observedAt) return;
    setSubmitting(true);
    setError(null);
    try {
      const { evidence } = await createEvidence(tenantId, {
        outcomeId,
        source,
        observedAt: new Date(observedAt).toISOString(),
        classification,
      });
      if (file) {
        await uploadEvidenceFile(tenantId, evidence.id, file);
      }
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
            <DialogTitle>{t('addEvidenceButton')}</DialogTitle>
            <DialogDescription>{t('addEvidenceDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="evidence-source" label={t('sourceLabel')} hint={t('sourceHint')}>
            <Input
              id="evidence-source"
              required
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </FormField>

          <FormField id="evidence-file" label={t('fileLabel')} hint={t('fileHint')}>
            <Input
              id="evidence-file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField id="evidence-observed" label={t('observedAtLabel')}>
              <DateInput
                id="evidence-observed"
                required
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
              />
            </FormField>
            <FormField id="evidence-classification" label={t('classificationLabel')}>
              <Select
                value={classification}
                onValueChange={(value) => setClassification(value as EvidenceClassification)}
              >
                <SelectTrigger id="evidence-classification">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERNAL">{t('classificationInternal')}</SelectItem>
                  <SelectItem value="SHAREABLE">{t('classificationShareable')}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!source || !observedAt} loading={submitting}>
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceRow({
  tenantId,
  evidence,
  canWrite,
  onSaved,
}: {
  tenantId: string;
  evidence: Evidence;
  canWrite: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations('evidenceOutcomes');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (fileList: FileList | null) => {
    const selected = fileList?.[0];
    if (!selected) return;
    setUploading(true);
    setError(null);
    try {
      await uploadEvidenceFile(tenantId, evidence.id, selected);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-md border border-[var(--border-default)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-ink truncate text-sm font-medium">{evidence.source}</p>
          <p className="text-muted-body truncate text-xs">
            {t(`classification.${evidence.classification}`)} ·{' '}
            {new Date(evidence.observedAt).toLocaleDateString()}
            {evidence.fileName ? ` · ${evidence.fileName}` : ''}
          </p>
          {error && <p className="text-status-alert text-xs">{error}</p>}
        </div>
        {canWrite && !evidence.storageKey && (
          <label className="text-muted-body flex cursor-pointer items-center gap-1 text-xs hover:underline">
            <Upload className="size-3.5" aria-hidden="true" />
            {uploading ? t('uploading') : t('uploadFileButton')}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
