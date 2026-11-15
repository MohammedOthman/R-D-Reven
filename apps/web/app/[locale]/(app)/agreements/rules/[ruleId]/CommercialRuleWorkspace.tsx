'use client';

import { useWorkspaceDate } from '@/src/components/WorkspaceFormat';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
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
import {
  createCommercialRuleVersion,
  testCommercialRuleVersion,
  updateCommercialRuleVersion,
} from '@/src/lib/commercial-rules/client';
import { ApiError } from '@/src/lib/api/error';
import type { MembershipRole } from '@/src/lib/tenant/types';
import {
  RULE_OPERATORS,
  type CommercialRule,
  type CommercialRuleVersion,
  type RuleCondition,
  type RuleDefinition,
  type RuleOperator,
} from '@/src/lib/commercial-rules/types';

const WRITE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const APPROVE_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'REVIEWER'];

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

/** "gt 100" stays numeric, "in a,b,c" becomes an array — everything else stays a string, matching what the operator actually compares against. */
function parseConditionValue(operator: RuleOperator, raw: string): unknown {
  if (operator === 'in') {
    return raw.split(',').map((part) => {
      const trimmed = part.trim();
      const asNumber = Number(trimmed);
      return trimmed !== '' && Number.isFinite(asNumber) ? asNumber : trimmed;
    });
  }
  if (operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') {
    return Number(raw);
  }
  return raw;
}

function conditionValueToInput(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  return String(value ?? '');
}

export function CommercialRuleWorkspace({
  tenantId,
  initialRule,
  currentRole,
}: {
  tenantId: string;
  initialRule: CommercialRule;
  currentRole: MembershipRole;
}) {
  const formatDate = useWorkspaceDate();
  const t = useTranslations('commercialRules');
  const router = useRouter();
  const canWrite = WRITE_ROLES.includes(currentRole);
  const canApprove = APPROVE_ROLES.includes(currentRole);

  const rule = initialRule;
  const versions = [...(rule.versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber);
  const [versionOpen, setVersionOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<CommercialRuleVersion | null>(null);
  const [testingVersion, setTestingVersion] = useState<CommercialRuleVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (version: CommercialRuleVersion) => {
    setBusy(true);
    setError(null);
    try {
      await updateCommercialRuleVersion(tenantId, rule.id, version.id, {
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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={rule.name}
        description={t(`type.${rule.type}`)}
        actions={
          <Button
            variant="ghost"
            onClick={() => router.push('/agreements/rules')}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('backButton')}
          </Button>
        }
      />

      {error && <p className="text-status-alert text-sm">{error}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('versionsTitle')}</CardTitle>
            <CardDescription>{t('versionsDescription')}</CardDescription>
          </div>
          {canWrite && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setVersionOpen(true)}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('addVersionButton')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {versions.length === 0 ? (
            <EmptyState title={t('noVersionsTitle')} />
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="flex flex-col gap-3 rounded-md border border-[var(--border-default)] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink truncate text-sm font-medium">
                      {t('versionLabel', { number: v.versionNumber })}
                    </p>
                    <p className="text-muted-body truncate text-xs">
                      {t('precedenceLabel')}: {v.precedence} · {formatDate(v.effectiveFrom)}
                      {' – '}
                      {v.effectiveTo ? formatDate(v.effectiveTo) : t('openEnded')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={t(`approvalStatus.${v.approvalStatus}`)}
                      tone={v.approvalStatus === 'APPROVED' ? 'positive' : 'neutral'}
                    />
                    {canWrite && (
                      <Button variant="ghost" size="sm" onClick={() => setTestingVersion(v)}>
                        {t('testButton')}
                      </Button>
                    )}
                    {canWrite && v.approvalStatus === 'DRAFT' && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingVersion(v)}>
                        {t('editButton')}
                      </Button>
                    )}
                    {canApprove && v.approvalStatus === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busy}
                        onClick={() => handleApprove(v)}
                      >
                        {t('approveButton')}
                      </Button>
                    )}
                  </div>
                </div>

                <RuleDefinitionSummary definition={v.definition} />

                {v.testResults && (
                  <div className="border-t border-[var(--border-default)] pt-2">
                    <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
                      {t('lastTestLabel', { date: formatDate(v.testResults.ranAt, true) })}
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {v.testResults.cases.map((c, i) => (
                        <li key={i} className="text-xs">
                          <StatusBadge
                            label={c.passed ? t('testPassed') : t('testFailed')}
                            tone={c.passed ? 'positive' : 'alert'}
                          />{' '}
                          <span className="text-ink">{c.label || t('unlabeledCase')}</span>
                          <span className="text-muted-body">
                            {' '}
                            —{' '}
                            {t('expectedActual', {
                              expected: String(c.expectedResult),
                              actual: String(c.actualResult),
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canWrite && versionOpen && (
        <VersionDialog
          open={versionOpen}
          onOpenChange={setVersionOpen}
          title={t('addVersionButton')}
          description={t('addVersionDescription')}
          submitLabel={(submitting) => (submitting ? t('creating') : t('create'))}
          initialPrecedence={0}
          initialEffectiveFrom=""
          initialEffectiveTo=""
          initialDefinition={{
            combinator: 'AND',
            conditions: [{ field: '', operator: 'eq', value: '' }],
          }}
          onSubmit={(values) =>
            createCommercialRuleVersion(tenantId, rule.id, {
              definition: values.definition,
              precedence: values.precedence,
              effectiveFrom: new Date(values.effectiveFrom).toISOString(),
              effectiveTo: values.effectiveTo
                ? new Date(values.effectiveTo).toISOString()
                : undefined,
            })
          }
          onSaved={() => {
            setVersionOpen(false);
            router.refresh();
          }}
        />
      )}

      {canWrite && editingVersion && (
        <VersionDialog
          open={!!editingVersion}
          onOpenChange={(next) => {
            if (!next) setEditingVersion(null);
          }}
          title={t('editVersionTitle', { number: editingVersion.versionNumber })}
          description={t('editVersionDescription')}
          submitLabel={() => t('save')}
          initialPrecedence={editingVersion.precedence}
          initialEffectiveFrom={editingVersion.effectiveFrom.slice(0, 10)}
          initialEffectiveTo={editingVersion.effectiveTo?.slice(0, 10) ?? ''}
          initialDefinition={editingVersion.definition}
          onSubmit={(values) =>
            updateCommercialRuleVersion(tenantId, rule.id, editingVersion.id, {
              version: editingVersion.version,
              definition: values.definition,
              precedence: values.precedence,
              effectiveFrom: new Date(values.effectiveFrom).toISOString(),
              effectiveTo: values.effectiveTo
                ? new Date(values.effectiveTo).toISOString()
                : undefined,
            })
          }
          onSaved={() => {
            setEditingVersion(null);
            router.refresh();
          }}
        />
      )}

      {testingVersion && (
        <TestVersionDialog
          open={!!testingVersion}
          onOpenChange={(next) => {
            if (!next) setTestingVersion(null);
          }}
          tenantId={tenantId}
          ruleId={rule.id}
          version={testingVersion}
          onSaved={() => {
            setTestingVersion(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RuleDefinitionSummary({ definition }: { definition: RuleDefinition }) {
  const t = useTranslations('commercialRules');
  return (
    <div className="text-sm">
      <p className="text-muted-body text-xs tracking-[var(--tracking-label)] uppercase">
        {t('definitionLabel')}
      </p>
      <p className="text-ink">
        {definition.conditions
          .map((c) => `${c.field} ${c.operator} ${conditionValueToInput(c.value)}`)
          .join(` ${definition.combinator} `)}
      </p>
    </div>
  );
}

interface VersionFormValues {
  precedence: number;
  effectiveFrom: string;
  effectiveTo: string;
  definition: RuleDefinition;
}

function VersionDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialPrecedence,
  initialEffectiveFrom,
  initialEffectiveTo,
  initialDefinition,
  onSubmit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: (submitting: boolean) => string;
  initialPrecedence: number;
  initialEffectiveFrom: string;
  initialEffectiveTo: string;
  initialDefinition: RuleDefinition;
  onSubmit: (values: VersionFormValues) => Promise<unknown>;
  onSaved: () => void;
}) {
  const t = useTranslations('commercialRules');
  const [precedence, setPrecedence] = useState(initialPrecedence);
  const [effectiveFrom, setEffectiveFrom] = useState(initialEffectiveFrom);
  const [effectiveTo, setEffectiveTo] = useState(initialEffectiveTo);
  const [combinator, setCombinator] = useState<'AND' | 'OR'>(initialDefinition.combinator);
  const [conditions, setConditions] = useState<
    { field: string; operator: RuleOperator; value: string }[]
  >(
    initialDefinition.conditions.map((c) => ({
      field: c.field,
      operator: c.operator,
      value: conditionValueToInput(c.value),
    })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCondition = (index: number, patch: Partial<(typeof conditions)[number]>) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const canSubmit =
    effectiveFrom &&
    conditions.length > 0 &&
    conditions.every((c) => c.field.trim() && c.value.trim());

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const definition: RuleDefinition = {
        combinator,
        conditions: conditions.map<RuleCondition>((c) => ({
          field: c.field.trim(),
          operator: c.operator,
          value: parseConditionValue(c.operator, c.value),
        })),
      };
      await onSubmit({ precedence, effectiveFrom, effectiveTo, definition });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, t('genericError')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('cancel')} className="max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <FormField id="rule-version-effective-from" label={t('effectiveFromLabel')}>
              <DateInput
                id="rule-version-effective-from"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </FormField>
            <FormField
              id="rule-version-effective-to"
              label={t('effectiveToLabel')}
              hint={t('effectiveToHint')}
            >
              <DateInput
                id="rule-version-effective-to"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </FormField>
          </div>

          <FormField
            id="rule-version-precedence"
            label={t('precedenceLabel')}
            hint={t('precedenceHint')}
          >
            <Input
              id="rule-version-precedence"
              type="number"
              value={precedence}
              onChange={(e) => setPrecedence(Number(e.target.value))}
            />
          </FormField>

          <FormField id="rule-version-combinator" label={t('combinatorLabel')}>
            <Select value={combinator} onValueChange={(v) => setCombinator(v as 'AND' | 'OR')}>
              <SelectTrigger id="rule-version-combinator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">{t('combinatorAnd')}</SelectItem>
                <SelectItem value="OR">{t('combinatorOr')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex flex-col gap-2">
            <p className="text-muted-body text-xs font-medium tracking-[var(--tracking-label)] uppercase">
              {t('conditionsLabel')}
            </p>
            {conditions.map((c, i) => (
              <div key={i} className="flex items-end gap-2">
                <FormField id={`condition-field-${i}`} label={i === 0 ? t('fieldLabel') : ''}>
                  <Input
                    id={`condition-field-${i}`}
                    value={c.field}
                    onChange={(e) => updateCondition(i, { field: e.target.value })}
                  />
                </FormField>
                <FormField id={`condition-operator-${i}`} label={i === 0 ? t('operatorLabel') : ''}>
                  <Select
                    value={c.operator}
                    onValueChange={(v) => updateCondition(i, { operator: v as RuleOperator })}
                  >
                    <SelectTrigger id={`condition-operator-${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_OPERATORS.map((op) => (
                        <SelectItem key={op} value={op}>
                          {op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField id={`condition-value-${i}`} label={i === 0 ? t('valueLabel') : ''}>
                  <Input
                    id={`condition-value-${i}`}
                    value={c.value}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={conditions.length === 1}
                  onClick={() => setConditions((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={t('removeConditionButton')}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() =>
                setConditions((prev) => [...prev, { field: '', operator: 'eq', value: '' }])
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('addConditionButton')}
            </Button>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit} loading={submitting}>
              {submitLabel(submitting)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TestVersionDialog({
  open,
  onOpenChange,
  tenantId,
  ruleId,
  version,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  ruleId: string;
  version: CommercialRuleVersion;
  onSaved: () => void;
}) {
  const t = useTranslations('commercialRules');
  const [casesJson, setCasesJson] = useState(
    JSON.stringify(
      [{ label: t('sampleCaseLabel'), input: { amount: 100 }, expectedResult: true }],
      null,
      2,
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const cases = JSON.parse(casesJson);
      if (!Array.isArray(cases) || cases.length === 0) {
        throw new Error(t('invalidCasesError'));
      }
      await testCommercialRuleVersion(tenantId, ruleId, version.id, { cases });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message);
      } else if (err instanceof SyntaxError) {
        setError(t('invalidJsonError'));
      } else {
        setError(err instanceof Error ? err.message : t('genericError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('cancel')} className="max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('testButton')}</DialogTitle>
            <DialogDescription>{t('testDialogDescription')}</DialogDescription>
          </DialogHeader>

          {error && <p className="text-status-alert text-sm">{error}</p>}

          <FormField id="test-cases-json" label={t('sampleCasesLabel')} hint={t('sampleCasesHint')}>
            <Textarea
              id="test-cases-json"
              rows={10}
              className="font-mono text-xs"
              value={casesJson}
              onChange={(e) => setCasesJson(e.target.value)}
            />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={submitting}>
              {t('runTestButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
