'use client';

import { useWorkspaceDate } from '@/src/components/WorkspaceFormat';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, ArrowLeft } from 'lucide-react';
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
import { createCommercialRule } from '@/src/lib/commercial-rules/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import type { CommercialRule, CommercialRuleType } from '@/src/lib/commercial-rules/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const RULE_TYPES: CommercialRuleType[] = ['ELIGIBILITY', 'ATTRIBUTION'];
const NONE = '__none__';

export function CommercialRulesContent({
  tenantId,
  initialCommercialRules,
  currentRole,
}: {
  tenantId: string;
  initialCommercialRules: CommercialRule[];
  currentRole: MembershipRole;
}) {
  const formatDate = useWorkspaceDate();
  const t = useTranslations('commercialRules');
  const router = useRouter();
  const canWrite = WRITE_ROLES.includes(currentRole);
  const [formOpen, setFormOpen] = useState(false);

  const columns: DataTableColumn<CommercialRule>[] = [
    {
      key: 'name',
      header: t('nameHeader'),
      render: (r) => <p className="text-ink truncate text-sm font-medium">{r.name}</p>,
    },
    {
      key: 'type',
      header: t('typeHeader'),
      render: (r) => <StatusBadge label={t(`type.${r.type}`)} tone="neutral" />,
    },
    {
      key: 'createdAt',
      header: t('createdAtHeader'),
      render: (r) => formatDate(r.createdAt),
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
            <Button variant="ghost" onClick={() => router.push('/agreements')} className="gap-1.5">
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('backToAgreementsButton')}
            </Button>
            {canWrite && (
              <Button onClick={() => setFormOpen(true)} className="gap-1.5">
                <Plus className="size-4" aria-hidden="true" />
                {t('newRuleButton')}
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={initialCommercialRules}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/agreements/rules/${r.id}`)}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      {canWrite && (
        <CreateRuleDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          tenantId={tenantId}
          onCreated={(id) => router.push(`/agreements/rules/${id}`)}
        />
      )}
    </div>
  );
}

function CreateRuleDialog({
  open,
  onOpenChange,
  tenantId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onCreated: (ruleId: string) => void;
}) {
  const t = useTranslations('commercialRules');
  const [name, setName] = useState('');
  const [type, setType] = useState(NONE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name || type === NONE) return;
    setSubmitting(true);
    setError(null);
    try {
      const { commercialRule } = await createCommercialRule(tenantId, {
        name,
        type: type as CommercialRuleType,
      });
      onOpenChange(false);
      onCreated(commercialRule.id);
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
          setName('');
          setType(NONE);
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

          <FormField id="rule-name" label={t('nameLabel')}>
            <Input id="rule-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>

          <FormField id="rule-type" label={t('typeLabel')}>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="rule-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('selectTypePlaceholder')}</SelectItem>
                {RULE_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {t(`type.${rt}`)}
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
            <Button type="submit" disabled={!name || type === NONE} loading={submitting}>
              {submitting ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
