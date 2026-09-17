'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Download, ArrowLeft } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  StepChips,
  FormField,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  StatusBadge,
  DataTable,
  type DataTableColumn,
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
import {
  uploadImportFile,
  setImportMapping,
  updateImportRow,
  commitImport,
} from '@/src/lib/imports/client';
import { ApiError } from '@/src/lib/api/error';
import {
  IMPORT_TARGET_FIELDS,
  type ImportBatch,
  type ImportFieldMapping,
  type ImportRow,
  type ImportRowDisposition,
  type ImportTargetField,
} from '@/src/lib/imports/types';

const NONE = '__none__';
const API_URL = process.env.NEXT_PUBLIC_API_URL;

type Step = 'upload' | 'mapping' | 'preview' | 'results';

const DISPOSITION_TONE: Record<
  ImportRowDisposition,
  'neutral' | 'accent' | 'positive' | 'caution' | 'alert'
> = {
  PENDING: 'neutral',
  CREATE: 'positive',
  UPDATE: 'accent',
  SKIP: 'caution',
  REJECT: 'alert',
};

function rowSummary(row: ImportRow, mapping: ImportFieldMapping): string {
  const legalCol = mapping.legalName;
  const name = legalCol ? row.rawData[legalCol] : undefined;
  return name?.trim() || `Row ${row.rowNumber}`;
}

export function ImportWizard({ tenantId }: { tenantId: string }) {
  const t = useTranslations('partnerships.import');
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [mapping, setMapping] = useState<Record<ImportTargetField, string>>(
    Object.fromEntries(IMPORT_TARGET_FIELDS.map((f) => [f, NONE])) as Record<
      ImportTargetField,
      string
    >,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCommit, setConfirmingCommit] = useState(false);

  const errorMessage = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.body.code === 'CONFLICT') return t('conflictError');
      if (err.body.code === 'PAYLOAD_TOO_LARGE') return t('fileTooLargeError');
      if (err.body.code === 'UNSUPPORTED_MEDIA_TYPE' || err.body.code === 'UNPROCESSABLE_ENTITY') {
        return err.body.message;
      }
    }
    return t('genericError');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { batch: uploaded } = await uploadImportFile(tenantId, file);
      setBatch(uploaded);
      // Best-effort default mapping: an exact (case-insensitive) header match to a target field name.
      const auto: Record<ImportTargetField, string> = { ...mapping };
      for (const field of IMPORT_TARGET_FIELDS) {
        const match = uploaded.columnHeaders.find((h) => h.toLowerCase() === field.toLowerCase());
        if (match) auto[field] = match;
      }
      setMapping(auto);
      setStep('mapping');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleMappingSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!batch) return;
    setBusy(true);
    setError(null);
    try {
      const payload: ImportFieldMapping = {};
      for (const field of IMPORT_TARGET_FIELDS) {
        if (mapping[field] !== NONE) payload[field] = mapping[field];
      }
      const { batch: mapped } = await setImportMapping(tenantId, batch.id, {
        version: batch.version,
        mapping: payload,
      });
      setBatch(mapped);
      setStep('preview');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleForceCreate = async (row: ImportRow) => {
    if (!batch) return;
    setBusy(true);
    try {
      const { batch: updated } = await updateImportRow(
        tenantId,
        batch.id,
        row.id,
        !row.forceCreate,
      );
      setBatch(updated);
    } catch (err) {
      toast({ title: t('genericErrorTitle'), description: errorMessage(err), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!batch) return;
    setBusy(true);
    setError(null);
    try {
      const { batch: committed } = await commitImport(tenantId, batch.id);
      setBatch(committed);
      setConfirmingCommit(false);
      setStep('results');
    } catch (err) {
      setError(errorMessage(err));
      setConfirmingCommit(false);
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { id: 'upload', label: t('steps.upload') },
    { id: 'mapping', label: t('steps.mapping') },
    { id: 'preview', label: t('steps.preview') },
    { id: 'results', label: t('steps.results') },
  ];
  const completedStepIds = steps
    .slice(
      0,
      steps.findIndex((s) => s.id === step),
    )
    .map((s) => s.id);

  const rejectedHref = batch
    ? `${API_URL}/tenants/${tenantId}/imports/${batch.id}/rejected.csv`
    : undefined;

  const columns: DataTableColumn<ImportRow>[] = batch
    ? [
        { key: 'rowNumber', header: t('preview.rowHeader'), render: (r) => r.rowNumber },
        {
          key: 'summary',
          header: t('preview.valueHeader'),
          render: (r) => rowSummary(r, batch.fieldMapping ?? {}),
        },
        {
          key: 'disposition',
          header: t('preview.dispositionHeader'),
          render: (r) => (
            <StatusBadge
              label={t(`preview.disposition.${r.disposition}`)}
              tone={DISPOSITION_TONE[r.disposition]}
            />
          ),
        },
        {
          key: 'reason',
          header: t('preview.reasonHeader'),
          render: (r) => r.matchReason || r.rejectReason || '—',
        },
        {
          key: 'actions',
          header: '',
          align: 'end' as const,
          render: (r) =>
            r.disposition === 'SKIP' ? (
              <Button variant="ghost" size="sm" loading={busy} onClick={() => handleForceCreate(r)}>
                {r.forceCreate ? t('preview.undoForceButton') : t('preview.forceCreateButton')}
              </Button>
            ) : null,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button variant="ghost" onClick={() => router.push('/partnerships')} className="gap-1.5">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('backButton')}
          </Button>
        }
      />

      <StepChips steps={steps} currentStepId={step} completedStepIds={completedStepIds} />

      {error && <p className="text-status-alert text-sm">{error}</p>}

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('upload.title')}</CardTitle>
            <CardDescription>{t('upload.description')}</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpload}>
            <CardContent>
              <FormField id="import-file" label={t('upload.fileLabel')} hint={t('upload.fileHint')}>
                <input
                  id="import-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="font-body text-ink file:bg-canvas file:text-ink w-full rounded-md border border-[var(--border-default)] px-3 py-2 text-sm file:me-3 file:rounded-md file:border file:border-[var(--border-default)] file:px-3 file:py-1.5"
                />
              </FormField>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={!file} loading={busy} className="gap-1.5">
                <Upload className="size-4" aria-hidden="true" />
                {busy ? t('upload.uploading') : t('upload.uploadButton')}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === 'mapping' && batch && (
        <Card>
          <CardHeader>
            <CardTitle>{t('mapping.title')}</CardTitle>
            <CardDescription>{t('mapping.description', { count: batch.rowCount })}</CardDescription>
          </CardHeader>
          <form onSubmit={handleMappingSubmit}>
            <CardContent className="grid grid-cols-2 gap-4">
              {IMPORT_TARGET_FIELDS.map((field) => (
                <FormField
                  key={field}
                  id={`mapping-${field}`}
                  label={t(`mapping.fields.${field}`) + (field === 'legalName' ? ' *' : '')}
                >
                  <Select
                    value={mapping[field]}
                    onValueChange={(value) => setMapping((m) => ({ ...m, [field]: value }))}
                  >
                    <SelectTrigger id={`mapping-${field}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t('mapping.notMappedOption')}</SelectItem>
                      {batch.columnHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              ))}
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={mapping.legalName === NONE} loading={busy}>
                {busy ? t('mapping.saving') : t('mapping.continueButton')}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === 'preview' && batch && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <StatusBadge
              label={t('preview.summary.create', { count: batch.createdCount })}
              tone="positive"
            />
            <StatusBadge
              label={t('preview.summary.update', { count: batch.updatedCount })}
              tone="accent"
            />
            <StatusBadge
              label={t('preview.summary.skip', { count: batch.skippedCount })}
              tone="caution"
            />
            <StatusBadge
              label={t('preview.summary.reject', { count: batch.rejectedCount })}
              tone="alert"
            />
          </div>

          <DataTable
            columns={columns}
            data={batch.rows}
            getRowId={(r) => r.id}
            emptyTitle={t('preview.emptyTitle')}
          />

          <div className="flex items-center justify-between">
            {batch.rejectedCount > 0 && rejectedHref ? (
              <a
                href={rejectedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                <Download className="size-4" aria-hidden="true" />
                {t('preview.downloadRejectedLink')}
              </a>
            ) : (
              <span />
            )}
            <Button onClick={() => setConfirmingCommit(true)} loading={busy}>
              {t('preview.commitButton')}
            </Button>
          </div>
        </div>
      )}

      {step === 'results' && batch && (
        <Card>
          <CardHeader>
            <CardTitle>{t('results.title')}</CardTitle>
            <CardDescription>{t('results.description')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <StatusBadge
              label={t('preview.summary.create', { count: batch.createdCount })}
              tone="positive"
            />
            <StatusBadge
              label={t('preview.summary.update', { count: batch.updatedCount })}
              tone="accent"
            />
            <StatusBadge
              label={t('preview.summary.skip', { count: batch.skippedCount })}
              tone="caution"
            />
            <StatusBadge
              label={t('preview.summary.reject', { count: batch.rejectedCount })}
              tone="alert"
            />
          </CardContent>
          <CardFooter className="justify-between">
            {batch.rejectedCount > 0 && rejectedHref ? (
              <a
                href={rejectedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                <Download className="size-4" aria-hidden="true" />
                {t('preview.downloadRejectedLink')}
              </a>
            ) : (
              <span />
            )}
            <Button onClick={() => router.push('/partnerships')}>{t('results.doneButton')}</Button>
          </CardFooter>
        </Card>
      )}

      <Dialog open={confirmingCommit} onOpenChange={setConfirmingCommit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('commitConfirm.title')}</DialogTitle>
            <DialogDescription>
              {batch &&
                t('commitConfirm.description', {
                  create: batch.createdCount,
                  update: batch.updatedCount,
                })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('commitConfirm.cancel')}
              </Button>
            </DialogClose>
            <Button onClick={handleCommit} loading={busy}>
              {t('commitConfirm.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
