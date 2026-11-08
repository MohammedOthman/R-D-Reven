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
import { createAgreementVersion, updateAgreement, updateAgreementVersion } from '@/src/lib/agreements/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { Initiative } from '@/src/lib/initiatives/types';
import {
  VALID_AGREEMENT_TRANSITIONS,
  type Agreement,
  type AgreementStatus,
  type AgreementVersion,
} from '@/src/lib/agreements/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const APPROVE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'REVIEWER'];
const NONE = '__none__';

const STATUS_TONE: Record<AgreementStatus, 'neutral' | 'accent' | 'positive' | 'caution' | 'alert'> = {
  CAPTURED: 'neutral',
  IN_REVIEW: 'accent',
  EFFECTIVE: 'positive',
  AMENDED: 'positive',
  SUSPENDED: 'caution',
  EXPIRED: 'neutral',
  TERMINATED: 'alert',
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

export function AgreementWorkspace({
  tenantId,
  initialAgreement,
  partnerName,
  initiatives,
  currentRole,
}: {
  tenantId: string;
  initialAgreement: Agreement;
  partnerName: string | null;
  initiatives: Initiative[];
  currentRole: MembershipRole;
}) {
  const t = useTranslations('agreements');
  const router = useRouter();
  const canWrite = WRITE_ROLES.includes(currentRole);
  const canApprove = APPROVE_ROLES.includes(currentRole);

  const agreement = initialAgreement;
  const versions = [...(agreement.versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber);
  const [versionOpen, setVersionOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<AgreementVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiativeName = (id: string | null) =>
    id ? (initiatives.find((i) => i.id === id)?.objective ?? '—') : '—';

  const handleTransition = async (status: AgreementStatus) => {
    setBusy(true);
    setError(null);
    try {
      await updateAgreement(tenantId, agreement.id, { version: agreement.version, status });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (version: AgreementVersion) => {
    setBusy(true);
    setError(null);
    try {
      await updateAgreementVersion(tenantId, agreement.id, version.id, {
        version: version.version,
        approvalStatus: 'APPROVED',
      });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setBusy(false);
    }
  };

  const nextStatuses = VALID_AGREEMENT_TRANSITIONS[agreement.status];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={partnerName ? `${t('eyebrow')} — ${partnerName}` : t('eyebrow')}
        title={agreement.sourceRef || t('title')}
        description={t('workspaceDescription')}
        actions={
          <Button variant="ghost" onClick={() => router.push('/agreements')} className="gap-1.5">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('backButton')}
          </Button>
        }
      />

      {error && <p className="text-status-alert text-sm">{error}</p>}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={t(`status.${agreement.status}`)} tone={STATUS_TONE[agreement.status]} />
          </div>

          {canWrite && nextStatuses.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-[var(--border-default)] pt-4">
              <p className="text-muted-body text-xs font-medium tracking-[var(--tracking-label)] uppercase">
                {t('availableTransitionsLabel')}
              </p>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={busy}
                    onClick={() => handleTransition(status)}
                  >
                    {t('moveTo', { status: t(`status.${status}`) })}
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
            <CardTitle>{t('versionsTitle')}</CardTitle>
            <CardDescription>{t('versionsDescription')}</CardDescription>
          </div>
          {canWrite && agreement.status !== 'EXPIRED' && agreement.status !== 'TERMINATED' && (
            <Button size="sm" variant="secondary" onClick={() => setVersionOpen(true)} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              {t('addVersionButton')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {versions.length === 0 ? (
            <EmptyState title={t('noVersionsTitle')} />
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="flex flex-col gap-2 rounded-md border border-[var(--border-default)] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink truncate text-sm font-medium">
                      {t('versionLabel', { number: v.versionNumber })}
                    </p>
                    <p className="text-muted-body truncate text-xs">
                      {new Date(v.effectiveFrom).toLocaleDateString()}
                      {' – '}
                      {v.effectiveTo ? new Date(v.effectiveTo).toLocaleDateString() : t('openEnded')}
                      {v.initiativeId ? ` · ${initiativeName(v.initiativeId)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={t(`approvalStatus.${v.approvalStatus}`)}
                      tone={v.approvalStatus === 'APPROVED' ? 'positive' : 'neutral'}
                    />
                    {canWrite && v.approvalStatus === 'DRAFT' && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingVersion(v)}>
                        {t('editButton')}
                      </Button>
                    )}
                    {canApprove && v.approvalStatus === 'DRAFT' && (
                      <Button variant="ghost" size="sm" loading={busy} onClick={() => handleApprove(v)}>
                        {t('approveButton')}
                      </Button>
                    )}
                  </div>
                </div>
                {v.terms && <p className="text-ink text-sm whitespace-pre-wrap">{v.terms}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <AddVersionDialog
          open={versionOpen}
          onOpenChange={setVersionOpen}
          tenantId={tenantId}
          agreementId={agreement.id}
          initiatives={initiatives}
          onSaved={() => router.refresh()}
        />
      )}

      {canWrite && editingVersion && (
        <EditVersionDialog
          open={!!editingVersion}
          onOpenChange={(next) => {
            if (!next) setEditingVersion(null);
          }}
          tenantId={tenantId}
          agreementId={agreement.id}
          version={editingVersion}
          onSaved={() => {
            setEditingVersion(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddVersionDialog({
  open,
  onOpenChange,
  tenantId,
  agreementId,
  initiatives,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  agreementId: string;
  initiatives: Initiative[];
  onSaved: () => void;
}) {
  const t = useTranslations('agreements');
  const [terms, setTerms] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [initiativeId, setInitiativeId] = useState(NONE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTerms('');
    setEffectiveFrom('');
    setEffectiveTo('');
    setInitiativeId(NONE);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!effectiveFrom) return;
    setSubmitting(true);
    setError(null);
    try {
      await createAgreementVersion(tenantId, agreementId, {
        terms: terms || undefined,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
        initiativeId: initiativeId === NONE ? undefined : initiativeId,
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('addVersionButton')}</DialogTitle>
            <DialogDescription>{t('addVersionDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="version-terms" label={t('termsLabel')}>
            <Textarea id="version-terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField id="version-effective-from" label={t('effectiveFromLabel')}>
              <DateInput
                id="version-effective-from"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </FormField>
            <FormField id="version-effective-to" label={t('effectiveToLabel')} hint={t('effectiveToHint')}>
              <DateInput
                id="version-effective-to"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </FormField>
          </div>

          <FormField id="version-initiative" label={t('initiativeLabel')} hint={t('initiativeHint')}>
            <Select value={initiativeId} onValueChange={setInitiativeId}>
              <SelectTrigger id="version-initiative">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('noneOption')}</SelectItem>
                {initiatives.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.objective}
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
            <Button type="submit" disabled={!effectiveFrom} loading={submitting}>
              {submitting ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditVersionDialog({
  open,
  onOpenChange,
  tenantId,
  agreementId,
  version,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  agreementId: string;
  version: AgreementVersion;
  onSaved: () => void;
}) {
  const t = useTranslations('agreements');
  const [terms, setTerms] = useState(version.terms ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(version.effectiveFrom.slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState(version.effectiveTo?.slice(0, 10) ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateAgreementVersion(tenantId, agreementId, version.id, {
        version: version.version,
        terms,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
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
            <DialogTitle>{t('editVersionTitle', { number: version.versionNumber })}</DialogTitle>
            <DialogDescription>{t('editVersionDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="edit-version-terms" label={t('termsLabel')}>
            <Textarea id="edit-version-terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField id="edit-version-effective-from" label={t('effectiveFromLabel')}>
              <DateInput
                id="edit-version-effective-from"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </FormField>
            <FormField
              id="edit-version-effective-to"
              label={t('effectiveToLabel')}
              hint={t('effectiveToHint')}
            >
              <DateInput
                id="edit-version-effective-to"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={submitting}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
