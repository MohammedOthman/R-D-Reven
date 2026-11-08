'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Handshake, Plus, Trash2, Download } from 'lucide-react';
import {
  PageHeader,
  Button,
  Input,
  Textarea,
  DateInput,
  SearchInput,
  FormField,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  useToast,
  StatusBadge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  Pill,
  StepChips,
  Avatar,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Skeleton,
  FilterBar,
} from '@revn/ui';

const colorSwatches = [
  { name: 'Ink', variable: '--color-ink', hex: '#0F1629', on: 'light' as const },
  { name: 'Canvas', variable: '--color-canvas', hex: '#FBFAF7', on: 'light' as const },
  { name: 'Card White', variable: '--color-card', hex: '#FFFFFF', on: 'light' as const },
  { name: 'Accent Blue', variable: '--color-accent', hex: '#2C5BFF', on: 'dark' as const },
  { name: 'Accent Deep', variable: '--color-accent-deep', hex: '#1E47E0', on: 'dark' as const },
  { name: 'Accent Pale', variable: '--color-accent-pale-1', hex: '#8DA4FF', on: 'dark' as const },
  { name: 'Body', variable: '--color-muted-body', hex: '#5B6172', on: 'dark' as const },
  { name: 'Caption', variable: '--color-muted-caption', hex: '#6B7180', on: 'dark' as const },
  { name: 'Tertiary', variable: '--color-muted-tertiary', hex: '#8A8F9C', on: 'dark' as const },
  { name: 'Micro', variable: '--color-muted-micro', hex: '#9AA3B5', on: 'dark' as const },
  { name: 'Caution', variable: '--color-status-caution', hex: '#C98A1B', on: 'dark' as const },
  { name: 'Alert', variable: '--color-status-alert', hex: '#C0392B', on: 'dark' as const },
  { name: 'Positive', variable: '--color-status-positive', hex: '#1F8A5B', on: 'dark' as const },
];

interface SampleRow {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'atRisk';
  owner: string;
  updated: string;
}

const sampleRows: SampleRow[] = [
  {
    id: '1',
    name: 'Northwind Cloud',
    status: 'active',
    owner: 'Owen Frasier',
    updated: '2 days ago',
  },
  {
    id: '2',
    name: 'Globex Corp',
    status: 'pending',
    owner: 'Dana Whitfield',
    updated: '1 week ago',
  },
  {
    id: '3',
    name: 'Summit Integrations',
    status: 'atRisk',
    owner: 'Theo Nakamura',
    updated: '3 weeks ago',
  },
];

const statusTone = {
  active: 'positive',
  pending: 'accent',
  atRisk: 'alert',
} as const;

export function DesignSystemShowcase() {
  const t = useTranslations('designSystem');
  const s = useTranslations('designSystem.sections');

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-14 pb-24">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />

      <ColorSection title={s('colors')} />
      <TypographySection title={s('typography')} />
      <ButtonSection title={s('buttons')} />
      <FormSection title={s('forms')} />
      <FeedbackSection title={s('feedback')} />
      <DataDisplaySection title={s('dataDisplay')} />
      <StatesSection title={s('states')} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="font-label text-muted-tertiary text-xs font-semibold tracking-[var(--tracking-label-wide)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ColorSection({ title }: { title: string }) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {colorSwatches.map((swatch) => (
          <div
            key={swatch.variable}
            className="overflow-hidden rounded-lg border border-[var(--border-default)]"
          >
            <div className="h-16" style={{ backgroundColor: `var(${swatch.variable})` }} />
            <div className="bg-card p-3">
              <p className="font-body text-ink text-sm font-semibold">{swatch.name}</p>
              <p className="font-label text-muted-tertiary text-xs">{swatch.hex}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TypographySection({ title }: { title: string }) {
  return (
    <Section title={title}>
      <Card>
        <CardContent className="flex flex-col gap-6">
          <div>
            <p className="font-label text-muted-tertiary text-xs tracking-[var(--tracking-label)] uppercase">
              Display · Sora 800
            </p>
            <p className="font-display text-ink text-3xl font-extrabold tracking-[var(--tracking-display)]">
              Run partnerships like a predictable revenue line.
            </p>
          </div>
          <div>
            <p className="font-label text-muted-tertiary text-xs tracking-[var(--tracking-label)] uppercase">
              Body · Manrope 400–700
            </p>
            <p className="font-body text-ink text-base">
              Reven is the operating system for revenue shared between companies.
            </p>
          </div>
          <div>
            <p className="font-label text-muted-tertiary text-xs tracking-[var(--tracking-label)] uppercase">
              Label · IBM Plex Mono
            </p>
            <p className="font-label text-ink text-sm font-medium tracking-[var(--tracking-label-wide)] uppercase">
              Partner Revenue OS · Investor Pitch
            </p>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}

function ButtonSection({ title }: { title: string }) {
  return (
    <Section title={title}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link button</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add">
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button leadingIcon={<Handshake className="size-4" aria-hidden="true" />}>
              With icon
            </Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}

function FormSection({ title }: { title: string }) {
  const [textareaValue, setTextareaValue] = useState('');
  return (
    <Section title={title}>
      <Card>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            id="ds-name"
            label="Partnership name"
            hint="As it should appear across the workspace."
          >
            <Input id="ds-name" placeholder="e.g. Northwind Cloud" />
          </FormField>
          <FormField id="ds-name-error" label="Partnership name" error="This field is required.">
            <Input id="ds-name-error" invalid placeholder="e.g. Northwind Cloud" />
          </FormField>
          <FormField id="ds-select" label="Health">
            <Select>
              <SelectTrigger id="ds-select">
                <SelectValue placeholder="Choose a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on-track">On track</SelectItem>
                <SelectItem value="at-risk">At risk</SelectItem>
                <SelectItem value="stalled">Stalled</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="ds-date" label="Next review">
            <DateInput id="ds-date" />
          </FormField>
          <FormField id="ds-search" label="Search" className="sm:col-span-2">
            <SearchInput
              id="ds-search"
              placeholder="Search partnerships, initiatives, agreements…"
            />
          </FormField>
          <FormField
            id="ds-textarea"
            label="Notes"
            optional
            hint="Visible to your organization only."
            className="sm:col-span-2"
          >
            <Textarea
              id="ds-textarea"
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              maxLength={280}
              showCount
              placeholder="Add context for the next reviewer…"
            />
          </FormField>
          <FormField id="ds-disabled" label="Locked field" className="sm:col-span-2">
            <Input id="ds-disabled" disabled value="Managed by an integration" />
          </FormField>
        </CardContent>
      </Card>
    </Section>
  );
}

function FeedbackSection({ title }: { title: string }) {
  const { toast } = useToast();
  return (
    <Section title={title}>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archive this partnership?</DialogTitle>
                <DialogDescription>
                  This is a sample confirmation dialog. Archiving stops future reviews from being
                  scheduled.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
                >
                  Archive
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="secondary"
            onClick={() =>
              toast({ title: 'Saved', description: 'Your changes were saved.', variant: 'success' })
            }
          >
            Trigger success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: 'Sync delayed',
                description: 'The CRM connector is retrying.',
                variant: 'warning',
              })
            }
          >
            Trigger warning toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: 'Action failed',
                description: 'Could not reach the server.',
                variant: 'error',
              })
            }
          >
            Trigger error toast
          </Button>
        </CardContent>
      </Card>
    </Section>
  );
}

function DataDisplaySection({ title }: { title: string }) {
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const columns: DataTableColumn<SampleRow>[] = [
    { key: 'name', header: 'Name', sortable: true },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          label={
            row.status === 'active' ? 'Active' : row.status === 'pending' ? 'Pending' : 'At risk'
          }
          tone={statusTone[row.status]}
        />
      ),
    },
    { key: 'owner', header: 'Owner' },
    { key: 'updated', header: 'Updated', align: 'end' },
  ];

  return (
    <Section title={title}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Contributions"
          value="5"
          trend={{ direction: 'up', label: '+2 this month' }}
        />
        <StatCard label="Eligible amount" value="$162,800" />
        <StatCard
          label="Disputes"
          value="1"
          trend={{ direction: 'down', label: '-1 this month', tone: 'positive' }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill selected>All</Pill>
        <Pill>Active</Pill>
        <Pill>Pending</Pill>
        <Pill>At risk</Pill>
      </div>

      <div className="flex items-center gap-3">
        <Avatar name="Owen Frasier" />
        <Avatar name="Dana Whitfield" size="sm" />
      </div>

      <StepChips
        steps={[
          { id: 'sourced', label: 'Sourced' },
          { id: 'verified', label: 'Verified' },
          { id: 'settled', label: 'Settled' },
        ]}
        currentStepId="verified"
        completedStepIds={['sourced']}
      />

      <FilterBar
        search={<SearchInput placeholder="Filter rows…" />}
        filters={
          <>
            <Pill selected>All</Pill>
            <Pill>Active</Pill>
          </>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Download className="size-4" aria-hidden="true" />}
          >
            Export
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={sampleRows}
        getRowId={(row) => row.id}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(key) => {
          if (key === sortKey) {
            setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
          } else {
            setSortKey(key);
            setSortDirection('asc');
          }
        }}
      />
    </Section>
  );
}

function StatesSection({ title }: { title: string }) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loading</CardTitle>
            <CardDescription>Skeletons and spinner</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <LoadingState />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Empty</CardTitle>
            <CardDescription>No blank dashboards</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No initiatives yet"
              description="Create the first joint initiative for this partnership to start tracking progress."
              action={<Button size="sm">New initiative</Button>}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorState action={<Button size="sm">Retry</Button>} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Forbidden</CardTitle>
          </CardHeader>
          <CardContent>
            <ForbiddenState />
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
