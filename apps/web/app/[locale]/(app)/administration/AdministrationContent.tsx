'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { UserPlus, Ban, RotateCcw, XCircle } from 'lucide-react';
import {
  PageHeader,
  DataTable,
  type DataTableColumn,
  StatusBadge,
  Avatar,
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
  useToast,
} from '@revn/ui';
import { useRouter } from '@/src/i18n/navigation';
import { updateMember, createInvitation, revokeInvitation } from '@/src/lib/members/client';
import { ApiError } from '@/src/lib/api/error';
import { roleLabelKey } from '@/src/lib/tenant/roleLabels';
import { MEMBERSHIP_ROLES, type MembershipRole } from '@/src/lib/tenant/types';
import type { Member, Invitation } from '@/src/lib/members/types';

export function AdministrationContent({
  tenantId,
  initialMembers,
  initialInvitations,
  currentRole,
}: {
  tenantId: string;
  initialMembers: Member[];
  initialInvitations: Invitation[];
  currentRole: MembershipRole;
}) {
  const t = useTranslations('administration');
  const tRole = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const roleLabel = (role: MembershipRole) => tRole(roleLabelKey(role));

  const handleRoleChange = async (member: Member, role: MembershipRole) => {
    if (role === member.role) return;
    setBusyId(member.id);
    try {
      await updateMember(tenantId, member.id, { role });
      router.refresh();
    } catch (err) {
      toast({
        title: t('memberUpdateErrorTitle'),
        description:
          err instanceof ApiError && err.body.code === 'CONFLICT'
            ? t('lastOwnerError')
            : t('genericError'),
        variant: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStatus = async (member: Member) => {
    const nextStatus = member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setBusyId(member.id);
    try {
      await updateMember(tenantId, member.id, { status: nextStatus });
      router.refresh();
    } catch (err) {
      toast({
        title: t('memberUpdateErrorTitle'),
        description:
          err instanceof ApiError && err.body.code === 'CONFLICT'
            ? t('lastOwnerError')
            : t('genericError'),
        variant: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (invitation: Invitation) => {
    setBusyId(invitation.id);
    try {
      await revokeInvitation(tenantId, invitation.id);
      router.refresh();
    } catch {
      toast({ title: t('invitationErrorTitle'), description: t('genericError'), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const memberColumns: DataTableColumn<Member>[] = [
    {
      key: 'member',
      header: t('memberHeader'),
      render: (m) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={m.user.name} size="sm" />
          <div className="min-w-0">
            <p className="text-ink truncate text-sm font-medium">{m.user.name}</p>
            <p className="text-muted-body truncate text-xs">{m.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('roleHeader'),
      render: (m) => (
        <Select
          value={m.role}
          onValueChange={(value) => handleRoleChange(m, value as MembershipRole)}
        >
          <SelectTrigger className="h-9 w-40" disabled={busyId === m.id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEMBERSHIP_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {roleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: 'status',
      header: t('statusHeader'),
      render: (m) =>
        m.status === 'ACTIVE' ? (
          <StatusBadge label={t('statusActive')} tone="positive" />
        ) : (
          <StatusBadge label={t('statusSuspended')} tone="caution" />
        ),
    },
    {
      key: 'actions',
      header: t('actionsHeader'),
      align: 'end',
      render: (m) => (
        <Button
          variant="ghost"
          size="sm"
          loading={busyId === m.id}
          onClick={() => handleToggleStatus(m)}
          className="gap-1.5"
        >
          {m.status === 'ACTIVE' ? (
            <>
              <Ban className="size-4" aria-hidden="true" />
              {t('suspendAction')}
            </>
          ) : (
            <>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t('reactivateAction')}
            </>
          )}
        </Button>
      ),
    },
  ];

  const invitationColumns: DataTableColumn<Invitation>[] = [
    { key: 'email', header: t('invitationEmailHeader') },
    { key: 'role', header: t('roleHeader'), render: (i) => roleLabel(i.role) },
    {
      key: 'actions',
      header: t('actionsHeader'),
      align: 'end',
      render: (i) => (
        <Button
          variant="ghost"
          size="sm"
          loading={busyId === i.id}
          onClick={() => handleRevoke(i)}
          className="text-status-alert gap-1.5"
        >
          <XCircle className="size-4" aria-hidden="true" />
          {t('revokeAction')}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
            <UserPlus className="size-4" aria-hidden="true" />
            {t('inviteButton')}
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-ink text-base font-bold">{t('membersSectionTitle')}</h2>
        <DataTable columns={memberColumns} data={initialMembers} getRowId={(m) => m.id} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-ink text-base font-bold">
          {t('invitationsSectionTitle')}
        </h2>
        <DataTable
          columns={invitationColumns}
          data={initialInvitations}
          getRowId={(i) => i.id}
          emptyTitle={t('invitationsEmptyTitle')}
          emptyDescription={t('invitationsEmptyDescription')}
        />
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        tenantId={tenantId}
        currentRole={currentRole}
        onInvited={() => router.refresh()}
      />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  tenantId,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  currentRole: MembershipRole;
  onInvited: () => void;
}) {
  const t = useTranslations('administration');
  const tRole = useTranslations();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('MANAGER');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createInvitation(tenantId, { email, role });
      setEmail('');
      setRole('MANAGER');
      onOpenChange(false);
      onInvited();
    } catch (err) {
      setError(
        err instanceof ApiError && err.body.code === 'CONFLICT'
          ? t('inviteConflictError')
          : t('genericError'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('cancel')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('inviteDialogTitle')}</DialogTitle>
            <DialogDescription>{t('inviteDialogDescription')}</DialogDescription>
          </DialogHeader>

          <FormField id="invite-form-email" label={t('emailLabel')} error={error ?? undefined}>
            <Input
              id="invite-form-email"
              type="email"
              required
              invalid={!!error}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField id="invite-form-role" label={t('roleHeader')}>
            <Select value={role} onValueChange={(value) => setRole(value as MembershipRole)}>
              <SelectTrigger id="invite-form-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMBERSHIP_ROLES.filter((r) => r !== 'OWNER').map((r) => (
                  <SelectItem key={r} value={r}>
                    {tRole(roleLabelKey(r))}
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
            <Button type="submit" loading={submitting}>
              {submitting ? t('inviting') : t('sendInvite')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
