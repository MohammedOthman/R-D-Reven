'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
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
} from '@revn/ui';
import {
  createActionForInitiative,
  createActionForReview,
  updateAction,
} from '@/src/lib/actions/client';
import { ApiError } from '@/src/lib/api/error';
import { VALID_ACTION_TRANSITIONS, type Action, type ActionStatus } from '@/src/lib/actions/types';
import type { MemberSummary } from '@/src/lib/members/types';
import type { Milestone } from '@/src/lib/initiatives/types';

function errorMessage(err: unknown, fallback: string): string {
  if (
    err instanceof ApiError &&
    (err.body.code === 'CONFLICT' || err.body.code === 'UNPROCESSABLE_ENTITY')
  ) {
    return err.body.message;
  }
  return fallback;
}

/** Creates an action linked to an Initiative or a Review (not both) — see docs/DECISIONS.md on why Action is shared between the two. */
export function AddActionDialog({
  open,
  onOpenChange,
  tenantId,
  initiativeId,
  reviewId,
  members,
  milestones,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  initiativeId?: string;
  reviewId?: string;
  members: MemberSummary[];
  milestones?: Milestone[];
  onSaved: () => void;
}) {
  const t = useTranslations('initiatives');
  const NONE = '__none__';
  const [title, setTitle] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState(NONE);
  const [assigneeExternalName, setAssigneeExternalName] = useState('');
  const [milestoneId, setMilestoneId] = useState(NONE);
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setAssigneeUserId(NONE);
    setAssigneeExternalName('');
    setMilestoneId(NONE);
    setDueDate('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        title,
        assigneeUserId: assigneeUserId === NONE ? undefined : assigneeUserId,
        assigneeExternalName:
          assigneeUserId === NONE ? assigneeExternalName || undefined : undefined,
        milestoneId: milestoneId === NONE ? undefined : milestoneId,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };
      if (initiativeId) {
        await createActionForInitiative(tenantId, initiativeId, input);
      } else if (reviewId) {
        await createActionForReview(tenantId, reviewId, input);
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
            <DialogTitle>{t('addActionButton')}</DialogTitle>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="action-title" label={t('actionTitleLabel')}>
            <Input
              id="action-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>

          <FormField id="action-assignee" label={t('assigneeLabel')}>
            <Select value={assigneeUserId} onValueChange={setAssigneeUserId}>
              <SelectTrigger id="action-assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('externalAssigneeOption')}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {assigneeUserId === NONE && (
            <FormField id="action-external-name" label={t('externalAssigneeNameLabel')}>
              <Input
                id="action-external-name"
                value={assigneeExternalName}
                onChange={(e) => setAssigneeExternalName(e.target.value)}
              />
            </FormField>
          )}

          {milestones && milestones.length > 0 && (
            <FormField id="action-milestone" label={t('milestoneLabel')}>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger id="action-milestone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('noneOption')}</SelectItem>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <FormField id="action-due-date" label={t('dueDateLabel')}>
            <DateInput
              id="action-due-date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!title || (assigneeUserId === NONE && !assigneeExternalName.trim())}
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

export function UpdateActionDialog({
  open,
  onOpenChange,
  tenantId,
  action,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  action: Action;
  onSaved: () => void;
}) {
  const t = useTranslations('initiatives');
  const [pendingStatus, setPendingStatus] = useState<ActionStatus | null>(null);
  const [blockerReason, setBlockerReason] = useState('');
  const [completionNote, setCompletionNote] = useState(action.completionNote ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatuses = VALID_ACTION_TRANSITIONS[action.status];

  const handleTransition = async (status: ActionStatus) => {
    if (status === 'BLOCKED' && pendingStatus !== 'BLOCKED') {
      setPendingStatus('BLOCKED');
      setBlockerReason('');
      return;
    }
    if (status === 'BLOCKED' && !blockerReason.trim()) {
      setError(t('blockerReasonRequiredError'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updateAction(tenantId, action.id, {
        version: action.version,
        status,
        blockerReason: status === 'BLOCKED' ? blockerReason : undefined,
        completionNote: status === 'DONE' ? completionNote || undefined : undefined,
      });
      setPendingStatus(null);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNote = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateAction(tenantId, action.id, {
        version: action.version,
        completionNote: completionNote || undefined,
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
        <form onSubmit={handleSaveNote} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{action.title}</DialogTitle>
            <DialogDescription>
              {t('currentStatusLabel')}: {t(`actionStatus.${action.status}`)}
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="action-completion-note" label={t('completionNoteLabel')}>
            <Textarea
              id="action-completion-note"
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
            />
          </FormField>

          {pendingStatus === 'BLOCKED' && (
            <FormField
              id="action-blocker-reason"
              label={t('blockerReasonLabel')}
              hint={t('blockerReasonHint')}
            >
              <Textarea
                id="action-blocker-reason"
                value={blockerReason}
                onChange={(e) => setBlockerReason(e.target.value)}
                autoFocus
              />
            </FormField>
          )}

          {nextStatuses.length > 0 && (
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
                    loading={submitting}
                    onClick={() => handleTransition(status)}
                  >
                    {pendingStatus === status
                      ? t('confirmMoveTo', { stage: t(`actionStatus.${status}`) })
                      : t('moveTo', { stage: t(`actionStatus.${status}`) })}
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
            <Button type="submit" loading={submitting}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
