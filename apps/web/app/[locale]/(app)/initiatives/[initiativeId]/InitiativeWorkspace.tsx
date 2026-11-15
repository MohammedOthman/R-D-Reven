'use client';

import { useWorkspaceDate } from '@/src/components/WorkspaceFormat';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Plus, Check, RotateCcw } from 'lucide-react';
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
import { updateInitiative, createMilestone, updateMilestone } from '@/src/lib/initiatives/client';
import { AddActionDialog, UpdateActionDialog } from '@/src/components/actions/ActionDialogs';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { MemberSummary } from '@/src/lib/members/types';
import type { Action, ActionStatus } from '@/src/lib/actions/types';
import {
  COMPLETION_DISPOSITION_VALUES,
  INITIATIVE_HEALTH_VALUES,
  VALID_INITIATIVE_TRANSITIONS,
  type Initiative,
  type InitiativeStage,
  type Milestone,
} from '@/src/lib/initiatives/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const NONE = '__none__';

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

const ACTION_TONE: Record<ActionStatus, 'neutral' | 'accent' | 'positive' | 'caution' | 'alert'> = {
  OPEN: 'neutral',
  IN_PROGRESS: 'accent',
  BLOCKED: 'caution',
  DONE: 'positive',
  CANCELLED: 'alert',
};

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.body.code === 'CONFLICT') return err.body.message;
    if (err.body.code === 'UNPROCESSABLE_ENTITY') return err.body.message;
  }
  return fallback;
}

export function InitiativeWorkspace({
  tenantId,
  initialInitiative,
  partnerName,
  members,
  currentRole,
}: {
  tenantId: string;
  initialInitiative: Initiative;
  partnerName: string | null;
  members: MemberSummary[];
  currentRole: MembershipRole;
}) {
  const formatDate = useWorkspaceDate();
  const t = useTranslations('initiatives');
  const router = useRouter();
  const canWrite = WRITE_ROLES.includes(currentRole);

  const initiative = initialInitiative;
  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberName = (userId: string | null) => members.find((m) => m.id === userId)?.name ?? '—';

  const handleSimpleTransition = async (stage: InitiativeStage) => {
    setBusy(true);
    setError(null);
    try {
      await updateInitiative(tenantId, initiative.id, { version: initiative.version, stage });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setBusy(false);
    }
  };

  const handleMilestoneToggle = async (milestone: Milestone) => {
    setBusy(true);
    try {
      await updateMilestone(tenantId, initiative.id, milestone.id, {
        version: milestone.version,
        completed: !milestone.completedAt,
      });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setBusy(false);
    }
  };

  const nextStages = VALID_INITIATIVE_TRANSITIONS[initiative.stage];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={partnerName ? `${t('eyebrow')} — ${partnerName}` : t('eyebrow')}
        title={initiative.objective}
        description={t('workspaceDescription')}
        actions={
          <Button variant="ghost" onClick={() => router.push('/initiatives')} className="gap-1.5">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('backButton')}
          </Button>
        }
      />

      {error && <p className="text-status-alert text-sm">{error}</p>}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              label={t(`stage.${initiative.stage}`)}
              tone={STAGE_TONE[initiative.stage]}
            />
            {initiative.health && (
              <StatusBadge
                label={t(`health.${initiative.health}`)}
                tone={
                  initiative.health === 'HEALTHY'
                    ? 'positive'
                    : initiative.health === 'CRITICAL'
                      ? 'alert'
                      : 'caution'
                }
              />
            )}
            {canWrite && (
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                {t('editButton')}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('ownerHeader')}
              </p>
              <p className="text-ink">{memberName(initiative.ownerId)}</p>
            </div>
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('startDateLabel')}
              </p>
              <p className="text-ink">
                {initiative.startDate ? formatDate(initiative.startDate) : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('targetDateLabel')}
              </p>
              <p className="text-ink">
                {initiative.targetDate ? formatDate(initiative.targetDate) : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('visibilityLabel')}
              </p>
              <p className="text-ink">{t(`visibility.${initiative.visibility}`)}</p>
            </div>
          </div>

          {initiative.successMeasure && (
            <div className="text-sm">
              <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                {t('successMeasureLabel')}
              </p>
              <p className="text-ink">{JSON.stringify(initiative.successMeasure)}</p>
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
            <CardTitle>{t('milestonesTitle')}</CardTitle>
            <CardDescription>{t('milestonesDescription')}</CardDescription>
          </div>
          {canWrite && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMilestoneOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('addMilestoneButton')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!initiative.milestones || initiative.milestones.length === 0 ? (
            <EmptyState title={t('noMilestonesTitle')} />
          ) : (
            initiative.milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${m.completedAt ? 'text-muted-body line-through' : 'text-ink'}`}
                  >
                    {m.title}
                  </p>
                  <p className="text-muted-body text-xs">
                    {formatDate(m.targetDate)} · {memberName(m.ownerId)}
                  </p>
                </div>
                {canWrite && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busy}
                    onClick={() => handleMilestoneToggle(m)}
                    className="gap-1.5"
                  >
                    {m.completedAt ? (
                      <>
                        <RotateCcw className="size-4" aria-hidden="true" />
                        {t('reopenButton')}
                      </>
                    ) : (
                      <>
                        <Check className="size-4" aria-hidden="true" />
                        {t('completeButton')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('actionsTitle')}</CardTitle>
            <CardDescription>{t('actionsDescription')}</CardDescription>
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
          {!initiative.actions || initiative.actions.length === 0 ? (
            <EmptyState title={t('noActionsTitle')} />
          ) : (
            initiative.actions.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-ink truncate text-sm font-medium">{a.title}</p>
                  <p className="text-muted-body truncate text-xs">
                    {a.assigneeUserId ? memberName(a.assigneeUserId) : a.assigneeExternalName}
                    {a.dueDate ? ` · ${formatDate(a.dueDate)}` : ''}
                    {a.blockerReason ? ` · ${a.blockerReason}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={t(`actionStatus.${a.status}`)} tone={ACTION_TONE[a.status]} />
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
        <EditInitiativeDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          tenantId={tenantId}
          initiative={initiative}
          members={members}
          onSaved={() => router.refresh()}
        />
      )}

      {canWrite && (
        <CompleteInitiativeDialog
          open={completeOpen}
          onOpenChange={setCompleteOpen}
          tenantId={tenantId}
          initiative={initiative}
          hasBlockedActions={(initiative.actions ?? []).some((a) => a.status === 'BLOCKED')}
          onSaved={() => router.refresh()}
        />
      )}

      {canWrite && (
        <MilestoneDialog
          open={milestoneOpen}
          onOpenChange={setMilestoneOpen}
          tenantId={tenantId}
          initiativeId={initiative.id}
          members={members}
          onSaved={() => router.refresh()}
        />
      )}

      {canWrite && (
        <AddActionDialog
          open={actionOpen}
          onOpenChange={setActionOpen}
          tenantId={tenantId}
          initiativeId={initiative.id}
          members={members}
          milestones={initiative.milestones ?? []}
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

function EditInitiativeDialog({
  open,
  onOpenChange,
  tenantId,
  initiative,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  initiative: Initiative;
  members: MemberSummary[];
  onSaved: () => void;
}) {
  const t = useTranslations('initiatives');
  const successMeasure = (initiative.successMeasure ?? {}) as Record<string, string>;
  const [objective, setObjective] = useState(initiative.objective);
  const [ownerId, setOwnerId] = useState(initiative.ownerId ?? NONE);
  const [health, setHealth] = useState(initiative.health ?? NONE);
  const [smType, setSmType] = useState(successMeasure.type ?? '');
  const [smTarget, setSmTarget] = useState(successMeasure.target ?? '');
  const [smUnit, setSmUnit] = useState(successMeasure.unit ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateInitiative(tenantId, initiative.id, {
        version: initiative.version,
        objective,
        ownerId: ownerId === NONE ? undefined : ownerId,
        health: health === NONE ? undefined : (health as Initiative['health'] & string),
        successMeasure:
          smType || smTarget || smUnit
            ? { type: smType, target: smTarget, unit: smUnit }
            : undefined,
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
      <DialogContent closeLabel={t('cancel')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('editDialogTitle')}</DialogTitle>
            <DialogDescription>{t('editDialogDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="edit-objective" label={t('objectiveLabel')}>
            <Input
              id="edit-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField id="edit-owner" label={t('ownerLabel')}>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger id="edit-owner">
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
            <FormField id="edit-health" label={t('healthLabel')}>
              <Select value={health} onValueChange={setHealth}>
                <SelectTrigger id="edit-health">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('noneOption')}</SelectItem>
                  {INITIATIVE_HEALTH_VALUES.map((h) => (
                    <SelectItem key={h} value={h}>
                      {t(`health.${h}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField
            id="edit-sm-type"
            label={t('successMeasureTypeLabel')}
            hint={t('successMeasureHint')}
          >
            <Input id="edit-sm-type" value={smType} onChange={(e) => setSmType(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="edit-sm-target" label={t('successMeasureTargetLabel')}>
              <Input
                id="edit-sm-target"
                value={smTarget}
                onChange={(e) => setSmTarget(e.target.value)}
              />
            </FormField>
            <FormField id="edit-sm-unit" label={t('successMeasureUnitLabel')}>
              <Input id="edit-sm-unit" value={smUnit} onChange={(e) => setSmUnit(e.target.value)} />
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

function CompleteInitiativeDialog({
  open,
  onOpenChange,
  tenantId,
  initiative,
  hasBlockedActions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  initiative: Initiative;
  hasBlockedActions: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations('initiatives');
  const [disposition, setDisposition] = useState(NONE);
  const [treatment, setTreatment] = useState(NONE);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateInitiative(tenantId, initiative.id, {
        version: initiative.version,
        stage: 'COMPLETED',
        completionDisposition: disposition as Initiative['completionDisposition'] & string,
        remainingActionsTreatment: treatment as Initiative['remainingActionsTreatment'] & string,
        completionOverrideReason: hasBlockedActions ? overrideReason : undefined,
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
      <DialogContent closeLabel={t('cancel')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('completeDialogTitle')}</DialogTitle>
            <DialogDescription>{t('completeDialogDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="complete-disposition" label={t('completionDispositionLabel')}>
            <Select value={disposition} onValueChange={setDisposition}>
              <SelectTrigger id="complete-disposition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('noneOption')}</SelectItem>
                {COMPLETION_DISPOSITION_VALUES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`disposition.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="complete-treatment" label={t('remainingActionsTreatmentLabel')}>
            <Select value={treatment} onValueChange={setTreatment}>
              <SelectTrigger id="complete-treatment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('noneOption')}</SelectItem>
                <SelectItem value="CANCEL_REMAINING">{t('treatment.CANCEL_REMAINING')}</SelectItem>
                <SelectItem value="LEAVE_OPEN">{t('treatment.LEAVE_OPEN')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {hasBlockedActions && (
            <FormField
              id="complete-override"
              label={t('completionOverrideReasonLabel')}
              hint={t('completionOverrideReasonHint')}
            >
              <Textarea
                id="complete-override"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </FormField>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                disposition === NONE ||
                treatment === NONE ||
                (hasBlockedActions && !overrideReason.trim())
              }
              loading={submitting}
            >
              {t('completeButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MilestoneDialog({
  open,
  onOpenChange,
  tenantId,
  initiativeId,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  initiativeId: string;
  members: MemberSummary[];
  onSaved: () => void;
}) {
  const t = useTranslations('initiatives');
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [ownerId, setOwnerId] = useState(NONE);
  const [completionRule, setCompletionRule] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createMilestone(tenantId, initiativeId, {
        title,
        targetDate: new Date(targetDate).toISOString(),
        ownerId: ownerId === NONE ? undefined : ownerId,
        completionRule: completionRule || undefined,
      });
      onOpenChange(false);
      setTitle('');
      setTargetDate('');
      setOwnerId(NONE);
      setCompletionRule('');
      onSaved();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('cancel')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('addMilestoneButton')}</DialogTitle>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="milestone-title" label={t('milestoneTitleLabel')}>
            <Input
              id="milestone-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField id="milestone-date" label={t('targetDateLabel')}>
            <DateInput
              id="milestone-date"
              required
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </FormField>
          <FormField id="milestone-owner" label={t('ownerLabel')}>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger id="milestone-owner">
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
          <FormField
            id="milestone-rule"
            label={t('completionRuleLabel')}
            hint={t('completionRuleHint')}
          >
            <Input
              id="milestone-rule"
              value={completionRule}
              onChange={(e) => setCompletionRule(e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!title || !targetDate} loading={submitting}>
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
