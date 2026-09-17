'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Archive, RotateCcw, Handshake, FileUp, Download } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  type DataTableColumn,
  StatusBadge,
  Button,
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
  useToast,
} from '@revn/ui';
import { useRouter } from '@/src/i18n/navigation';
import { createPartner, updatePartner } from '@/src/lib/partners/client';
import { createPartnership, updatePartnership } from '@/src/lib/partnerships/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { Partner } from '@/src/lib/partners/types';
import type { MemberSummary } from '@/src/lib/members/types';
import {
  PARTNERSHIP_HEALTH_VALUES,
  VALID_PARTNERSHIP_TRANSITIONS,
  STAGES_REQUIRING_TRANSITION_REASON,
  type Partnership,
  type PartnershipHealth,
  type PartnershipStage,
} from '@/src/lib/partnerships/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
// S03's screen-actor is "Admin" specifically — narrower than Partnership's
// own write roles. See docs/DECISIONS.md.
const IMPORT_ROLES: MembershipRole[] = ['OWNER', 'ADMIN'];
// RPT-02: export is available to anyone who can already see this list —
// same "Portfolio read" role set the list route itself is gated to.
const EXPORT_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER'];
const NONE = '__none__';
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const STAGE_TONE: Record<
  PartnershipStage,
  'neutral' | 'accent' | 'positive' | 'caution' | 'alert'
> = {
  PROSPECT: 'neutral',
  QUALIFIED: 'neutral',
  PLANNING: 'accent',
  ACTIVE: 'positive',
  AT_RISK: 'caution',
  PAUSED: 'caution',
  TERMINATED: 'alert',
  ARCHIVED: 'neutral',
};

const HEALTH_TONE: Record<PartnershipHealth, 'positive' | 'caution' | 'alert'> = {
  HEALTHY: 'positive',
  NEEDS_ATTENTION: 'caution',
  CRITICAL: 'alert',
};

interface PartnerFormValues {
  legalName: string;
  displayName: string;
  segment: string;
  domains: string;
}

function toFormValues(partner?: Partner): PartnerFormValues {
  return {
    legalName: partner?.legalName ?? '',
    displayName: partner?.displayName ?? '',
    segment: partner?.segment ?? '',
    domains: partner?.domains.join(', ') ?? '',
  };
}

function parseDomains(input: string): string[] {
  return input
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

export function PartnershipsContent({
  tenantId,
  initialPartners,
  initialPartnerships,
  members,
  currentRole,
}: {
  tenantId: string;
  initialPartners: Partner[];
  initialPartnerships: Partnership[];
  members: MemberSummary[];
  currentRole: MembershipRole;
}) {
  const t = useTranslations('partnerships');
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = WRITE_ROLES.includes(currentRole);
  const canImport = IMPORT_ROLES.includes(currentRole);
  const canExport = EXPORT_ROLES.includes(currentRole);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [relationshipPartner, setRelationshipPartner] = useState<Partner | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const partnershipByPartnerId = new Map(initialPartnerships.map((p) => [p.partnerId, p]));

  const openCreate = () => {
    setEditingPartner(null);
    setFormOpen(true);
  };

  const openEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormOpen(true);
  };

  const handleToggleArchive = async (partner: Partner) => {
    setBusyId(partner.id);
    try {
      await updatePartner(tenantId, partner.id, {
        version: partner.version,
        status: partner.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE',
      });
      router.refresh();
    } catch (err) {
      toast({
        title: t('updateErrorTitle'),
        description:
          err instanceof ApiError && err.body.code === 'CONFLICT'
            ? t('conflictError')
            : t('genericError'),
        variant: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<Partner>[] = [
    {
      key: 'name',
      header: t('nameHeader'),
      render: (p) => (
        <div className="min-w-0">
          <p className="text-ink truncate text-sm font-medium">{p.displayName}</p>
          {p.displayName !== p.legalName && (
            <p className="text-muted-body truncate text-xs">{p.legalName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'segment',
      header: t('segmentHeader'),
      render: (p) => p.segment || '—',
    },
    {
      key: 'stage',
      header: t('stageHeader'),
      render: (p) => {
        const partnership = partnershipByPartnerId.get(p.id);
        return partnership ? (
          <StatusBadge
            label={t(`relationship.stage.${partnership.stage}`)}
            tone={STAGE_TONE[partnership.stage]}
          />
        ) : (
          <StatusBadge label={t('relationship.notStarted')} tone="neutral" />
        );
      },
    },
    {
      key: 'health',
      header: t('healthHeader'),
      render: (p) => {
        const health = partnershipByPartnerId.get(p.id)?.health;
        return health ? (
          <StatusBadge label={t(`relationship.health.${health}`)} tone={HEALTH_TONE[health]} />
        ) : (
          '—'
        );
      },
    },
    {
      key: 'domains',
      header: t('domainsHeader'),
      render: (p) => (p.domains.length > 0 ? p.domains.join(', ') : '—'),
    },
    {
      key: 'status',
      header: t('statusHeader'),
      render: (p) =>
        p.status === 'ACTIVE' ? (
          <StatusBadge label={t('statusActive')} tone="positive" />
        ) : (
          <StatusBadge label={t('statusArchived')} tone="neutral" />
        ),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: t('actionsHeader'),
            align: 'end' as const,
            render: (p: Partner) => (
              <div className="flex justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRelationshipPartner(p)}
                  className="gap-1.5"
                >
                  <Handshake className="size-4" aria-hidden="true" />
                  {t('relationship.manageAction')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="gap-1.5">
                  <Pencil className="size-4" aria-hidden="true" />
                  {t('editAction')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busyId === p.id}
                  onClick={() => handleToggleArchive(p)}
                  className="gap-1.5"
                >
                  {p.status === 'ACTIVE' ? (
                    <>
                      <Archive className="size-4" aria-hidden="true" />
                      {t('archiveAction')}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" aria-hidden="true" />
                      {t('reactivateAction')}
                    </>
                  )}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          canWrite || canImport || canExport ? (
            <div className="flex items-center gap-2">
              {canExport && (
                <a
                  href={`${API_URL}/tenants/${tenantId}/partnerships/export.csv`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  <Download className="size-4" aria-hidden="true" />
                  {t('exportButton')}
                </a>
              )}
              {canImport && (
                <Button
                  variant="secondary"
                  onClick={() => router.push('/partnerships/import')}
                  className="gap-1.5"
                >
                  <FileUp className="size-4" aria-hidden="true" />
                  {t('importButton')}
                </Button>
              )}
              {canWrite && (
                <Button onClick={openCreate} className="gap-1.5">
                  <Plus className="size-4" aria-hidden="true" />
                  {t('newPartnerButton')}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={initialPartners}
        getRowId={(p) => p.id}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      {canWrite && (
        <PartnerFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={tenantId}
          partner={editingPartner}
          onSaved={() => router.refresh()}
        />
      )}

      {canWrite && relationshipPartner && (
        <PartnershipDialog
          open={!!relationshipPartner}
          onOpenChange={(next) => {
            if (!next) setRelationshipPartner(null);
          }}
          tenantId={tenantId}
          partner={relationshipPartner}
          partnership={partnershipByPartnerId.get(relationshipPartner.id) ?? null}
          members={members}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

function PartnerFormDialog({
  open,
  onOpenChange,
  tenantId,
  partner,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  partner: Partner | null;
  onSaved: () => void;
}) {
  const t = useTranslations('partnerships');
  const [values, setValues] = useState<PartnerFormValues>(() => toFormValues(partner ?? undefined));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const domains = parseDomains(values.domains);
    try {
      if (partner) {
        await updatePartner(tenantId, partner.id, {
          version: partner.version,
          legalName: values.legalName,
          displayName: values.displayName || values.legalName,
          segment: values.segment || undefined,
          domains,
        });
      } else {
        await createPartner(tenantId, {
          legalName: values.legalName,
          displayName: values.displayName || undefined,
          segment: values.segment || undefined,
          domains,
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'CONFLICT') {
        setError(partner ? t('conflictError') : t('duplicateNameError'));
      } else {
        setError(t('genericError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValues(toFormValues(partner ?? undefined));
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{partner ? t('editDialogTitle') : t('createDialogTitle')}</DialogTitle>
            <DialogDescription>{t('formDialogDescription')}</DialogDescription>
          </DialogHeader>

          <FormField id="partner-legal-name" label={t('legalNameLabel')} error={error ?? undefined}>
            <Input
              id="partner-legal-name"
              required
              invalid={!!error}
              value={values.legalName}
              onChange={(e) => setValues((v) => ({ ...v, legalName: e.target.value }))}
            />
          </FormField>

          <FormField
            id="partner-display-name"
            label={t('displayNameLabel')}
            hint={t('displayNameHint')}
          >
            <Input
              id="partner-display-name"
              value={values.displayName}
              onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))}
            />
          </FormField>

          <FormField id="partner-segment" label={t('segmentLabel')}>
            <Input
              id="partner-segment"
              value={values.segment}
              onChange={(e) => setValues((v) => ({ ...v, segment: e.target.value }))}
            />
          </FormField>

          <FormField id="partner-domains" label={t('domainsLabel')} hint={t('domainsHint')}>
            <Input
              id="partner-domains"
              value={values.domains}
              onChange={(e) => setValues((v) => ({ ...v, domains: e.target.value }))}
            />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={submitting}>
              {submitting ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RelationshipFormValues {
  ownerId: string;
  sponsorId: string;
  motion: string;
  objective: string;
  cadence: string;
  health: string;
  nextReviewAt: string;
}

function toRelationshipFormValues(partnership: Partnership | null): RelationshipFormValues {
  return {
    ownerId: partnership?.ownerId ?? NONE,
    sponsorId: partnership?.sponsorId ?? NONE,
    motion: partnership?.motion ?? '',
    objective: partnership?.objective ?? '',
    cadence: partnership?.cadence ?? '',
    health: partnership?.health ?? NONE,
    nextReviewAt: partnership?.nextReviewAt?.slice(0, 10) ?? '',
  };
}

function PartnershipDialog({
  open,
  onOpenChange,
  tenantId,
  partner,
  partnership,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  partner: Partner;
  partnership: Partnership | null;
  members: MemberSummary[];
  onSaved: () => void;
}) {
  const t = useTranslations('partnerships');
  const [values, setValues] = useState<RelationshipFormValues>(() =>
    toRelationshipFormValues(partnership),
  );
  const [pendingStage, setPendingStage] = useState<PartnershipStage | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldsPayload = () => ({
    ownerId: values.ownerId === NONE ? undefined : values.ownerId,
    sponsorId: values.sponsorId === NONE ? undefined : values.sponsorId,
    motion: values.motion || undefined,
    objective: values.objective || undefined,
    cadence: values.cadence || undefined,
    health: values.health === NONE ? undefined : (values.health as PartnershipHealth),
    nextReviewAt: values.nextReviewAt ? new Date(values.nextReviewAt).toISOString() : undefined,
  });

  const errorMessage = (err: unknown, fallbackDuplicate: string) => {
    if (err instanceof ApiError) {
      if (err.body.code === 'CONFLICT') return t('conflictError');
      if (err.body.code === 'UNPROCESSABLE_ENTITY') return err.body.message;
      if (fallbackDuplicate && err.body.code === 'CONFLICT') return fallbackDuplicate;
    }
    return t('genericError');
  };

  const handleStart = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createPartnership(tenantId, partner.id, fieldsPayload());
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, t('relationship.duplicateError')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!partnership) return;
    setSubmitting(true);
    setError(null);
    try {
      await updatePartnership(tenantId, partner.id, {
        version: partnership.version,
        ...fieldsPayload(),
      });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransition = async (stage: PartnershipStage) => {
    if (!partnership) return;
    const needsReason = STAGES_REQUIRING_TRANSITION_REASON.includes(stage);
    if (needsReason && pendingStage !== stage) {
      setPendingStage(stage);
      setTransitionReason('');
      return;
    }
    if (needsReason && !transitionReason.trim()) {
      setError(t('relationship.reasonRequiredError'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updatePartnership(tenantId, partner.id, {
        version: partnership.version,
        stage,
        transitionReason: needsReason ? transitionReason : undefined,
        ...fieldsPayload(),
      });
      setPendingStage(null);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, ''));
    } finally {
      setSubmitting(false);
    }
  };

  const nextStages = partnership ? VALID_PARTNERSHIP_TRANSITIONS[partnership.stage] : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValues(toRelationshipFormValues(partnership));
          setPendingStage(null);
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <form
          onSubmit={partnership ? handleSave : handleStart}
          className="flex flex-col gap-4"
          noValidate
        >
          <DialogHeader>
            <DialogTitle>
              {partnership ? t('relationship.manageTitle') : t('relationship.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {partnership
                ? t('relationship.manageDescription', {
                    partner: partner.displayName,
                    stage: t(`relationship.stage.${partnership.stage}`),
                  })
                : t('relationship.createDescription', { partner: partner.displayName })}
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <FormField id="ship-owner" label={t('relationship.ownerLabel')}>
              <Select
                value={values.ownerId}
                onValueChange={(value) => setValues((v) => ({ ...v, ownerId: value }))}
              >
                <SelectTrigger id="ship-owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('relationship.noneOption')}</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="ship-sponsor" label={t('relationship.sponsorLabel')}>
              <Select
                value={values.sponsorId}
                onValueChange={(value) => setValues((v) => ({ ...v, sponsorId: value }))}
              >
                <SelectTrigger id="ship-sponsor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('relationship.noneOption')}</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField id="ship-motion" label={t('relationship.motionLabel')}>
            <Input
              id="ship-motion"
              value={values.motion}
              onChange={(e) => setValues((v) => ({ ...v, motion: e.target.value }))}
            />
          </FormField>

          <FormField id="ship-objective" label={t('relationship.objectiveLabel')}>
            <Textarea
              id="ship-objective"
              value={values.objective}
              onChange={(e) => setValues((v) => ({ ...v, objective: e.target.value }))}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="ship-cadence"
              label={t('relationship.cadenceLabel')}
              hint={t('relationship.cadenceHint')}
            >
              <Input
                id="ship-cadence"
                value={values.cadence}
                onChange={(e) => setValues((v) => ({ ...v, cadence: e.target.value }))}
              />
            </FormField>

            <FormField id="ship-next-review" label={t('relationship.nextReviewLabel')}>
              <DateInput
                id="ship-next-review"
                value={values.nextReviewAt}
                onChange={(e) => setValues((v) => ({ ...v, nextReviewAt: e.target.value }))}
              />
            </FormField>
          </div>

          {partnership && (
            <FormField id="ship-health" label={t('relationship.healthLabel')}>
              <Select
                value={values.health}
                onValueChange={(value) => setValues((v) => ({ ...v, health: value }))}
              >
                <SelectTrigger id="ship-health">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('relationship.noneOption')}</SelectItem>
                  {PARTNERSHIP_HEALTH_VALUES.map((h) => (
                    <SelectItem key={h} value={h}>
                      {t(`relationship.health.${h}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {partnership && pendingStage && (
            <FormField
              id="ship-transition-reason"
              label={t('relationship.transitionReasonLabel')}
              hint={t('relationship.transitionReasonHint')}
            >
              <Textarea
                id="ship-transition-reason"
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
                autoFocus
              />
            </FormField>
          )}

          {partnership && nextStages.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-[var(--border-default)] pt-4">
              <p className="text-muted-body text-xs font-medium tracking-[var(--tracking-label)] uppercase">
                {t('relationship.moveToLabel')}
              </p>
              <div className="flex flex-wrap gap-2">
                {nextStages.map((stage) => (
                  <Button
                    key={stage}
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={submitting && pendingStage === stage}
                    onClick={() => handleTransition(stage)}
                  >
                    {pendingStage === stage
                      ? t('relationship.confirmMoveTo', { stage: t(`relationship.stage.${stage}`) })
                      : t('relationship.moveTo', { stage: t(`relationship.stage.${stage}`) })}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={submitting && !pendingStage}>
              {submitting
                ? t('saving')
                : partnership
                  ? t('relationship.save')
                  : t('relationship.start')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
